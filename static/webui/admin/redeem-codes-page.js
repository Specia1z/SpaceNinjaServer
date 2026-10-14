(() => {
    let codes = [];
    let batchGenerationInProgress = false;
    const picker = () => window.adminDataPage;
    const find = id => document.getElementById(id);

    const isRedeemableRewardType = itemType =>
        itemType.startsWith("/Lotus/") ||
        [
            "RegularCredits",
            "PremiumCredits",
            "PremiumCreditsFree",
            "FusionPoints",
            "CrewShipFusionPoints",
            "PrimeTokens"
        ].includes(itemType);

    function parseRewardLines(id) {
        const lines = find(id)
            .value.split("\n")
            .map(line => line.trim())
            .filter(Boolean);
        if (!lines.length) throw new Error(loc("admin_redeemRewardsRequired"));
        return lines.map((line, index) => {
            const comma = line.lastIndexOf(",");
            const itemType = (comma == -1 ? line : line.slice(0, comma)).trim();
            if (!isRedeemableRewardType(itemType)) {
                throw new Error(
                    loc("admin_redeemInvalidReward")
                        .replace("|LINE|", index + 1)
                        .replace("|ITEM|", itemType)
                );
            }
            if (comma == -1) return { ItemType: itemType, ItemCount: 1 };
            const itemCount = Number(line.slice(comma + 1).trim());
            if (!Number.isInteger(itemCount) || itemCount == 0) {
                throw new Error(loc("admin_redeemInvalidCount").replace("|LINE|", index + 1));
            }
            return { ItemType: itemType, ItemCount: itemCount };
        });
    }

    const formatRewards = rewards =>
        (rewards ?? []).map(reward => `${reward.ItemType} x${reward.ItemCount}`).join("\n");
    const formatUsage = code => `${code.Uses} / ${code.MaxUses > 0 ? code.MaxUses : loc("admin_unlimited")}`;
    const isExpired = code => code.ExpiresAt && new Date(code.ExpiresAt).getTime() <= Date.now();
    const isExhausted = code => code.MaxUses > 0 && code.Uses >= code.MaxUses;
    const isActive = code => code.Enabled && !isExpired(code) && !isExhausted(code);

    function appendRewardTo(pickerId, textareaId) {
        const input = find(pickerId);
        const uniqueName = input.value.trim();
        if (!uniqueName) return;
        const textarea = find(textareaId);
        const line = `${uniqueName}, 1`;
        textarea.value = textarea.value.trim() ? `${textarea.value.trim()}\n${line}` : line;
        input.value = "";
        input.dispatchEvent(new Event("input"));
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    function showTab(tabId) {
        const tab = find(tabId);
        if (tab && window.bootstrap?.Tab) window.bootstrap.Tab.getOrCreateInstance(tab).show();
    }

    function resetForm() {
        find("admin-redeem-form").reset();
        find("admin-redeem-enabled").checked = true;
        find("admin-redeem-type").dispatchEvent(new Event("input"));
    }

    function editCode(code) {
        showTab("redeem-tab-create");
        find("admin-redeem-code").value = code.Code;
        find("admin-redeem-label").value = code.Label ?? "";
        find("admin-redeem-rewards").value = formatRewards(code.Rewards);
        find("admin-redeem-expires").value = code.ExpiresAt ? new Date(code.ExpiresAt).toISOString().slice(0, 16) : "";
        find("admin-redeem-max-uses").value = code.MaxUses ?? 0;
        find("admin-redeem-enabled").checked = code.Enabled;
        find("admin-redeem-code").scrollIntoView({ behavior: "smooth", block: "center" });
    }

    async function removeCode(code) {
        const confirmed = window.webuiComponents?.confirm
            ? await window.webuiComponents.confirm({
                  title: loc("admin_delete"),
                  message: loc("admin_deleteRedeemCodeConfirm").replace("|CODE|", code),
                  variant: "danger",
                  icon: "bi-trash"
              })
            : window.confirm(loc("admin_deleteRedeemCodeConfirm").replace("|CODE|", code));
        if (!confirmed) return;
        try {
            await window.redeemCodesApi.remove(code);
            await loadCodes();
            toast(loc("admin_redeemCodeDeleted"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    function renderRewardList(rewards) {
        const container = document.createElement("div");
        for (const reward of rewards ?? []) {
            const line = document.createElement("div");
            line.className = "mb-1";
            line.textContent = `${picker().itemDisplayLabel(reward.ItemType)} x${reward.ItemCount}`;
            const path = document.createElement("div");
            path.className = "small text-body-secondary text-break font-monospace";
            path.textContent = reward.ItemType;
            line.append(path);
            container.append(line);
        }
        return container;
    }

    const getCodeStatus = code => (isExpired(code) ? "expired" : isActive(code) ? "active" : "disabled");

    function getFilteredCodes() {
        const query = find("admin-redeem-search").value.trim().toLocaleLowerCase();
        const filter = find("admin-redeem-filter").value;
        return codes.filter(code => {
            const haystack = [code.Code, code.Label, ...(code.Rewards ?? []).map(reward => reward.ItemType)]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase();
            return (!query || haystack.includes(query)) && (filter == "all" || getCodeStatus(code) == filter);
        });
    }

    function renderCodes() {
        const tbody = find("admin-redeem-codes");
        tbody.replaceChildren();
        const filteredCodes = getFilteredCodes();
        for (const code of filteredCodes) {
            const row = tbody.insertRow();
            const codeCell = row.insertCell();
            codeCell.className = "font-monospace text-break";
            codeCell.textContent = code.Code;
            row.insertCell().textContent = code.Label ?? "";
            row.insertCell().append(renderRewardList(code.Rewards));
            row.insertCell().textContent = formatUsage(code);
            row.insertCell().textContent = picker().formatDate(code.ExpiresAt);
            const state = code.Enabled ? loc("admin_enabled") : loc("admin_disabled");
            row.insertCell().textContent = isExpired(code)
                ? `${state} / ${loc("admin_expired")}`
                : isExhausted(code)
                  ? `${state} / ${loc("admin_redeemExhausted")}`
                  : state;
            const actions = row.insertCell();
            const copy = document.createElement("button");
            copy.className = "btn btn-sm btn-outline-secondary me-2";
            copy.textContent = loc("admin_copy");
            copy.onclick = () =>
                navigator.clipboard.writeText(code.Code).then(
                    () => toast(loc("admin_codeCopied"), "success"),
                    () => toast(loc("admin_codeCopyFailed"), "danger")
                );
            const edit = document.createElement("button");
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.textContent = loc("admin_edit");
            edit.onclick = () => editCode(code);
            const remove = document.createElement("button");
            remove.className = "btn btn-sm btn-outline-danger";
            remove.textContent = loc("admin_delete");
            remove.onclick = () => void removeCode(code.Code);
            actions.append(copy, edit, remove);
        }

        const expiredCount = codes.filter(isExpired).length;
        const activeCount = codes.filter(isActive).length;
        const totalUses = codes.reduce((sum, code) => sum + (Number(code.Uses) || 0), 0);
        find("admin-redeem-total-count").textContent = codes.length.toLocaleString();
        find("admin-redeem-active-count").textContent = activeCount.toLocaleString();
        find("admin-redeem-total-uses").textContent = totalUses.toLocaleString();
        find("admin-redeem-empty").classList.toggle("d-none", filteredCodes.length > 0);
        find("admin-redeem-list-count").textContent = loc("admin_redeemListCount")
            .replace("|VISIBLE|", filteredCodes.length.toLocaleString())
            .replace("|TOTAL|", codes.length.toLocaleString())
            .replace("|EXPIRED|", expiredCount.toLocaleString());
    }

    async function loadCodes() {
        codes = await window.redeemCodesApi.list();
        renderCodes();
    }

    async function saveCode() {
        try {
            const payload = {
                Code: find("admin-redeem-code").value.trim(),
                Label: find("admin-redeem-label").value.trim(),
                Rewards: parseRewardLines("admin-redeem-rewards"),
                ExpiresAt: picker().optionalDate("admin-redeem-expires"),
                MaxUses: Number(find("admin-redeem-max-uses").value),
                Enabled: find("admin-redeem-enabled").checked
            };
            await window.redeemCodesApi.save(payload);
            resetForm();
            await loadCodes();
            showTab("redeem-tab-existing");
            toast(loc("admin_redeemCodeSaved"), "success");
        } catch (error) {
            toast(error.message || error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    const alphabets = {
        unambiguous: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
        alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        hex: "0123456789ABCDEF",
        digits: "0123456789"
    };

    const groupCode = (value, groupSize, separator) => {
        if (!groupSize) return value;
        const groups = [];
        for (let index = 0; index < value.length; index += groupSize) {
            groups.push(value.slice(index, index + groupSize));
        }
        return groups.join(separator);
    };

    function updateBatchFormatControls() {
        const format = find("admin-redeem-batch-format").value;
        const isRandom = format == "random";
        const isCustom = find("admin-redeem-batch-alphabet").value == "custom";
        const hasGrouping = Number(find("admin-redeem-batch-group-size").value) > 0;
        find("admin-redeem-batch-length").disabled = !isRandom;
        find("admin-redeem-batch-alphabet").disabled = !isRandom;
        find("admin-redeem-custom-alphabet-field").classList.toggle("d-none", !isRandom || !isCustom);
        find("admin-redeem-batch-custom-alphabet").required = isRandom && isCustom;
        find("admin-redeem-batch-custom-alphabet").disabled = !isRandom || !isCustom;
        find("admin-redeem-batch-group-size").disabled = !isRandom;
        find("admin-redeem-batch-separator").disabled = !isRandom || !hasGrouping;
    }

    function updateBatchPreview() {
        const format = find("admin-redeem-batch-format").value;
        const isRandom = format == "random";
        const count = Number(find("admin-redeem-batch-count").value);
        const prefix = find("admin-redeem-batch-prefix").value.trim().toUpperCase();
        const codeLength = Number(find("admin-redeem-batch-length").value);
        const alphabetName = find("admin-redeem-batch-alphabet").value;
        const customAlphabet = find("admin-redeem-batch-custom-alphabet").value.toUpperCase();
        const alphabet = alphabetName == "custom" ? customAlphabet : alphabets[alphabetName];
        const groupSize = isRandom ? Number(find("admin-redeem-batch-group-size").value) : 0;
        const separator = find("admin-redeem-batch-separator").value;
        const bodyLength = format == "uuid" ? 36 : format == "uuid-compact" ? 32 : codeLength;
        const separatorCount = groupSize ? Math.floor((bodyLength - 1) / groupSize) : 0;
        const totalLength = prefix.length + bodyLength + separatorCount;
        const prefixValid = prefix.length <= 24 && (!prefix || /^[A-Z0-9-]+$/.test(prefix));
        const lengthValid = !isRandom || (Number.isInteger(codeLength) && codeLength >= 4 && codeLength <= 64);
        const countValid = Number.isInteger(count) && count >= 1 && count <= 500;
        const customValid =
            !isRandom ||
            alphabetName != "custom" ||
            (/^[A-Z0-9]{2,36}$/.test(customAlphabet) && new Set(customAlphabet).size == customAlphabet.length);
        const outputValid = totalLength <= 64;
        const valid = countValid && prefixValid && lengthValid && customValid && outputValid;

        updateBatchFormatControls();
        const preview = find("admin-redeem-batch-preview");
        if (!valid) {
            preview.textContent = "—";
            find("admin-redeem-batch-summary").textContent = "";
            find("admin-redeem-batch-format-error").classList.remove("d-none");
        } else {
            let sample;
            let entropyBits;
            if (isRandom) {
                const sampleAlphabet = alphabet || "AB";
                const sampleBody = sampleAlphabet
                    .repeat(Math.ceil(codeLength / sampleAlphabet.length))
                    .slice(0, codeLength);
                sample = groupCode(sampleBody, groupSize, separator);
                entropyBits = Math.floor(codeLength * Math.log2(sampleAlphabet.length));
            } else {
                sample = format == "uuid" ? "XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX" : "XXXXXXXXXXXX4XXXYXXXXXXXXXXXXXXX";
                entropyBits = 122;
            }
            preview.textContent = `${prefix}${sample}`;
            find("admin-redeem-batch-summary").textContent = loc("admin_redeemFormatSummary")
                .replace("|COUNT|", count.toLocaleString())
                .replace(
                    "|FORMAT|",
                    loc(
                        format == "random"
                            ? "admin_redeemFormatRandom"
                            : format == "uuid"
                              ? "admin_redeemFormatUuid"
                              : "admin_redeemFormatUuidCompact"
                    )
                )
                .replace("|LENGTH|", totalLength)
                .replace("|BITS|", entropyBits.toLocaleString());
            find("admin-redeem-batch-format-error").classList.add("d-none");
        }
        find("admin-redeem-batch-submit").disabled = !valid || batchGenerationInProgress;
    }

    async function copyBatchCodes() {
        const value = find("admin-redeem-batch-output").value;
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            toast(loc("admin_redeemBatchCopied"), "success");
        } catch {
            toast(loc("admin_codeCopyFailed"), "danger");
        }
    }

    async function generateCodes() {
        const form = find("admin-redeem-batch-form");
        if (!form.reportValidity()) return;
        updateBatchPreview();
        if (find("admin-redeem-batch-submit").disabled) return;
        batchGenerationInProgress = true;
        updateBatchPreview();
        try {
            const payload = {
                Count: Number(find("admin-redeem-batch-count").value),
                Format: find("admin-redeem-batch-format").value,
                CodeLength: Number(find("admin-redeem-batch-length").value),
                Prefix: find("admin-redeem-batch-prefix").value.trim(),
                Label: find("admin-redeem-batch-label").value.trim(),
                Alphabet: find("admin-redeem-batch-alphabet").value,
                CustomAlphabet: find("admin-redeem-batch-custom-alphabet").value,
                GroupSize: Number(find("admin-redeem-batch-group-size").value),
                Separator: find("admin-redeem-batch-separator").value,
                Rewards: parseRewardLines("admin-redeem-batch-rewards"),
                ExpiresAt: picker().optionalDate("admin-redeem-batch-expires"),
                MaxUses: Number(find("admin-redeem-batch-max-uses").value),
                Enabled: find("admin-redeem-batch-enabled").checked
            };
            const result = await window.redeemCodesApi.generate(payload);
            const output = find("admin-redeem-batch-output");
            output.value = result.codes.map(code => code.Code).join("\n");
            find("admin-redeem-batch-result-summary").textContent = loc("admin_codesGenerated").replace(
                "|COUNT|",
                result.codes.length.toLocaleString()
            );
            find("admin-redeem-batch-result").classList.remove("d-none");
            await loadCodes();
            toast(loc("admin_codesGenerated").replace("|COUNT|", result.codes.length.toLocaleString()), "success");
            output.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (error) {
            toast(error.message || error.responseText || loc("settings_changeFailed"), "danger");
        } finally {
            batchGenerationInProgress = false;
            updateBatchPreview();
        }
    }

    function bind() {
        find("admin-redeem-form")?.addEventListener("submit", event => {
            event.preventDefault();
            void saveCode();
        });
        find("admin-redeem-batch-form")?.addEventListener("submit", event => {
            event.preventDefault();
            void generateCodes();
        });
        find("admin-redeem-reset")?.addEventListener("click", resetForm);
        find("admin-redeem-add-reward")?.addEventListener("click", () =>
            appendRewardTo("admin-redeem-type", "admin-redeem-rewards")
        );
        find("admin-redeem-batch-add-reward")?.addEventListener("click", () =>
            appendRewardTo("admin-redeem-batch-type", "admin-redeem-batch-rewards")
        );
        find("admin-redeem-refresh")?.addEventListener("click", () => void loadCodes());
        find("admin-redeem-search")?.addEventListener("input", renderCodes);
        find("admin-redeem-filter")?.addEventListener("change", renderCodes);
        find("admin-redeem-batch-copy")?.addEventListener("click", () => void copyBatchCodes());

        [
            "admin-redeem-batch-count",
            "admin-redeem-batch-format",
            "admin-redeem-batch-length",
            "admin-redeem-batch-prefix",
            "admin-redeem-batch-alphabet",
            "admin-redeem-batch-custom-alphabet",
            "admin-redeem-batch-group-size",
            "admin-redeem-batch-separator"
        ].forEach(id => {
            find(id)?.addEventListener("input", updateBatchPreview);
            find(id)?.addEventListener("change", updateBatchPreview);
        });
        updateBatchPreview();
    }

    bind();

    single.getRoute("/webui/redeem-codes").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) return;
            try {
                await Promise.all([loadCodes(), window.adminItemCatalog.load(window.lang)]);
                picker().setupItemPicker("admin-redeem-type", "admin-redeem-type-resolved");
                picker().setupItemPicker("admin-redeem-batch-type", "admin-redeem-batch-type-resolved");
                updateBatchPreview();
            } catch (error) {
                toast(error.responseText || loc("settings_changeFailed"), "danger");
            }
        });
    });
})();
