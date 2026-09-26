(() => {
    let codes = [];
    const picker = () => window.adminDataPage;

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
        const lines = document
            .getElementById(id)
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

    function appendRewardTo(pickerId, textareaId) {
        const input = document.getElementById(pickerId);
        const uniqueName = input.value.trim();
        if (!uniqueName) return;
        const textarea = document.getElementById(textareaId);
        const line = `${uniqueName}, 1`;
        textarea.value = textarea.value.trim() ? `${textarea.value.trim()}\n${line}` : line;
        input.value = "";
        input.dispatchEvent(new Event("input"));
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    function resetForm() {
        document.getElementById("admin-redeem-form").reset();
        document.getElementById("admin-redeem-enabled").checked = true;
        document.getElementById("admin-redeem-type").dispatchEvent(new Event("input"));
    }

    function editCode(code) {
        document.getElementById("admin-redeem-code").value = code.Code;
        document.getElementById("admin-redeem-label").value = code.Label ?? "";
        document.getElementById("admin-redeem-rewards").value = formatRewards(code.Rewards);
        document.getElementById("admin-redeem-expires").value = code.ExpiresAt
            ? new Date(code.ExpiresAt).toISOString().slice(0, 16)
            : "";
        document.getElementById("admin-redeem-max-uses").value = code.MaxUses ?? 0;
        document.getElementById("admin-redeem-enabled").checked = code.Enabled;
        document.getElementById("admin-redeem-code").scrollIntoView({ behavior: "smooth", block: "center" });
    }

    async function removeCode(code) {
        if (!confirm(loc("admin_deleteRedeemCodeConfirm").replace("|CODE|", code))) return;
        await window.redeemCodesApi.remove(code);
        await loadCodes();
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

    function renderCodes() {
        const tbody = document.getElementById("admin-redeem-codes");
        tbody.replaceChildren();
        codes.forEach(code => {
            const row = tbody.insertRow();
            const codeCell = row.insertCell();
            codeCell.className = "font-monospace text-break";
            codeCell.textContent = code.Code;
            row.insertCell().textContent = code.Label ?? "";
            row.insertCell().append(renderRewardList(code.Rewards));
            row.insertCell().textContent = formatUsage(code);
            row.insertCell().textContent = picker().formatDate(code.ExpiresAt);
            const state = code.Enabled ? loc("admin_enabled") : loc("admin_disabled");
            row.insertCell().textContent =
                code.ExpiresAt && new Date(code.ExpiresAt).getTime() <= Date.now()
                    ? `${state} / ${loc("admin_expired")}`
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
            remove.onclick = () => removeCode(code.Code);
            actions.append(copy, edit, remove);
        });
    }

    async function loadCodes() {
        codes = await window.redeemCodesApi.list();
        renderCodes();
    }

    async function saveCode() {
        try {
            const payload = {
                Code: document.getElementById("admin-redeem-code").value.trim(),
                Label: document.getElementById("admin-redeem-label").value.trim(),
                Rewards: parseRewardLines("admin-redeem-rewards"),
                ExpiresAt: picker().optionalDate("admin-redeem-expires"),
                MaxUses: Number(document.getElementById("admin-redeem-max-uses").value),
                Enabled: document.getElementById("admin-redeem-enabled").checked
            };
            await window.redeemCodesApi.save(payload);
            resetForm();
            await loadCodes();
            toast(loc("admin_redeemCodeSaved"), "success");
        } catch (error) {
            toast(error.message || error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    async function generateCodes() {
        try {
            const payload = {
                Count: Number(document.getElementById("admin-redeem-batch-count").value),
                CodeLength: Number(document.getElementById("admin-redeem-batch-length").value),
                Prefix: document.getElementById("admin-redeem-batch-prefix").value.trim(),
                Rewards: parseRewardLines("admin-redeem-batch-rewards"),
                ExpiresAt: picker().optionalDate("admin-redeem-batch-expires"),
                MaxUses: Number(document.getElementById("admin-redeem-batch-max-uses").value),
                Enabled: document.getElementById("admin-redeem-batch-enabled").checked
            };
            const result = await window.redeemCodesApi.generate(payload);
            const output = document.getElementById("admin-redeem-batch-result");
            output.textContent = result.codes.map(code => code.Code).join("\n");
            output.classList.remove("d-none");
            await loadCodes();
            toast(loc("admin_codesGenerated").replace("|COUNT|", result.codes.length), "success");
        } catch (error) {
            toast(error.message || error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    Object.assign(window, {
        appendAdminRedeemReward: () => appendRewardTo("admin-redeem-type", "admin-redeem-rewards"),
        appendAdminRedeemBatchReward: () => appendRewardTo("admin-redeem-batch-type", "admin-redeem-batch-rewards"),
        resetAdminRedeemForm: resetForm,
        loadAdminRedeemCodes: loadCodes,
        saveAdminRedeemCode: saveCode,
        generateAdminRedeemCodes: generateCodes
    });

    single.getRoute("/webui/redeem-codes").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) return;
            try {
                await loadCodes();
                window.itemListPromise.then(() => {
                    picker().setupItemPicker("admin-redeem-type", "admin-redeem-type-resolved");
                    picker().setupItemPicker("admin-redeem-batch-type", "admin-redeem-batch-type-resolved");
                });
            } catch (error) {
                toast(error.responseText || loc("settings_changeFailed"), "danger");
            }
        });
    });
})();
