(() => {
    const root = document.querySelector("[data-route='/webui/metadata-patches']");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const state = {
        globalPatches: [],
        accountPatches: {},
        metadataPatchBlacklist: [],
        accounts: [],
        selectedId: null,
        sources: [],
        revision: "",
        dirty: false,
        busy: false,
        previewRequest: 0,
        importTarget: "global",
        importModal: null,
        expandedPatches: new WeakMap()
    };

    const normalize = patch => ({
        name: patch.name ?? "",
        enabled: patch.enabled !== false,
        text: metadataPatchText.toText(patch)
    });

    function selectedAccount() {
        return state.accounts.find(account => account.id === state.selectedId);
    }

    function selectedPatches() {
        return state.selectedId ? (state.accountPatches[state.selectedId] ?? []) : [];
    }

    function selectedAccountIsBlacklisted() {
        return Boolean(state.selectedId && state.metadataPatchBlacklist.includes(state.selectedId));
    }

    function effectivePatches() {
        if (selectedAccountIsBlacklisted()) return [];
        return [...state.globalPatches, ...selectedPatches()];
    }

    function formatCount(count) {
        return `${count} ${loc("metadataPatches_count")}`;
    }

    function getSources() {
        return effectivePatches().map((patch, index) => ({
            order: index + 1,
            sourceLabel:
                index < state.globalPatches.length
                    ? loc("metadataPatches_globalSource")
                    : `${loc("metadataPatches_accountSource")} ${state.selectedId ?? ""}`,
            name: patch.name,
            enabled: patch.enabled !== false
        }));
    }

    function compiledPreview() {
        return metadataPatchText.preview(effectivePatches());
    }

    function renderPreview() {
        const compiled = compiledPreview();
        find("#metadata-patches-preview").textContent = compiled || loc("metadataPatches_emptyPreview");
        find("#metadata-patches-revision").textContent =
            state.dirty || !state.revision ? "" : `${loc("metadataPatches_revision")}: ${state.revision}`;

        const sources = getSources();
        const list = find("#metadata-patches-sources");
        list.replaceChildren();
        if (!sources.length) {
            const empty = document.createElement("p");
            empty.className = "metadata-patches-source-empty";
            empty.textContent = loc("metadataPatches_emptyPreview");
            list.append(empty);
            return;
        }

        for (const source of sources) {
            const row = document.createElement("div");
            row.className = "metadata-patches-source-row";

            const order = document.createElement("span");
            order.className = "badge text-bg-secondary metadata-patches-source-order";
            order.textContent = String(source.order);

            const label = document.createElement("span");
            label.className = "metadata-patches-source-label";
            label.textContent = source.sourceLabel;

            const name = document.createElement("span");
            name.className = "metadata-patches-source-name";
            name.textContent = source.name || loc("metadataPatches_unnamed");

            const status = document.createElement("span");
            status.className = `badge metadata-patches-source-status ${source.enabled ? "text-bg-success" : "text-bg-secondary"}`;
            status.textContent = loc(source.enabled ? "metadataPatches_enabled" : "metadataPatches_disabled");

            row.append(order, label, name, status);
            list.append(row);
        }
    }

    function renderSaveState() {
        const status = find("#metadata-patches-save-status");
        const saveState = find("#metadata-patches-save-state");
        const saveButton = find("#metadata-patches-save");
        const statusKey = state.busy
            ? "metadataPatches_savingStatus"
            : state.dirty
              ? "metadataPatches_unsavedStatus"
              : "metadataPatches_savedStatus";
        status.textContent = loc(statusKey);
        saveState.classList.toggle("is-dirty", state.dirty);
        saveButton.disabled = state.busy || !state.dirty;
    }

    function markDirty() {
        state.dirty = true;
        state.revision = "";
        renderPreview();
        renderSaveState();
    }

    function update(list, index, field, value) {
        list[index][field] = value;
        markDirty();
    }

    function move(list, index, delta, rerender) {
        const next = index + delta;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
        markDirty();
        rerender();
    }

    function remove(list, index, rerender) {
        list.splice(index, 1);
        markDirty();
        rerender();
    }

    function createActionButton(icon, title, handler, disabled, destructive = false) {
        const button = document.createElement("button");
        button.className = `btn btn-sm metadata-patch-action ${destructive ? "btn-outline-danger" : "btn-outline-secondary"}`;
        button.type = "button";
        button.innerHTML = icon;
        button.title = loc(title);
        button.setAttribute("aria-label", loc(title));
        button.disabled = disabled || state.busy;
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            handler();
        });
        return button;
    }

    function createEditor(list, patch, index, rerender) {
        const section = document.createElement("details");
        section.className = "metadata-patch-editor";

        const summary = document.createElement("summary");
        summary.className = "metadata-patch-summary";

        const order = document.createElement("span");
        order.className = "badge text-bg-secondary metadata-patch-order";
        order.textContent = String(index + 1);

        const summaryName = document.createElement("span");
        summaryName.className = "metadata-patch-summary-name";

        const summaryStatus = document.createElement("span");
        summaryStatus.className = "badge metadata-patch-summary-status";
        summary.append(order, summaryName, summaryStatus);

        const body = document.createElement("div");
        body.className = "metadata-patch-editor-body";

        const toolbar = document.createElement("div");
        toolbar.className = "metadata-patch-editor-toolbar";

        const enabledWrap = document.createElement("div");
        enabledWrap.className = "form-check form-switch metadata-patch-enabled";
        const enabled = document.createElement("input");
        enabled.className = "form-check-input";
        enabled.type = "checkbox";
        enabled.checked = patch.enabled !== false;
        enabled.disabled = state.busy;
        enabled.addEventListener("change", () => {
            update(list, index, "enabled", enabled.checked);
            updateSummary();
        });
        const enabledLabel = document.createElement("label");
        enabledLabel.className = "form-check-label";
        enabledLabel.textContent = loc("metadataPatches_enabled");
        enabledWrap.append(enabled, enabledLabel);
        toolbar.append(enabledWrap);

        const actions = [
            [icons.angleUp, "metadataPatches_moveUp", () => move(list, index, -1, rerender), index === 0, false],
            [
                icons.angleDown,
                "metadataPatches_moveDown",
                () => move(list, index, 1, rerender),
                index === list.length - 1,
                false
            ],
            [icons.trash, "metadataPatches_delete", () => remove(list, index, rerender), false, true]
        ];
        actions.forEach(([icon, title, handler, disabled, destructive]) => {
            toolbar.append(createActionButton(icon, title, handler, disabled, destructive));
        });
        body.append(toolbar);

        const nameLabel = document.createElement("label");
        nameLabel.className = "form-label";
        nameLabel.textContent = loc("metadataPatches_name");
        const name = document.createElement("input");
        name.className = "form-control metadata-patch-name";
        name.type = "text";
        name.maxLength = 200;
        name.value = patch.name;
        name.disabled = state.busy;
        name.addEventListener("input", () => {
            update(list, index, "name", name.value.trim());
            updateSummary();
        });
        body.append(nameLabel, name);

        const textLabel = document.createElement("label");
        textLabel.className = "form-label";
        textLabel.textContent = loc("metadataPatches_textLabel");
        const text = document.createElement("textarea");
        text.className = "form-control";
        text.rows = 14;
        text.value = patch.text;
        text.placeholder = loc("metadataPatches_importPlaceholder");
        text.disabled = state.busy;
        text.spellcheck = false;
        text.addEventListener("input", () => update(list, index, "text", text.value));
        const textHint = document.createElement("div");
        textHint.className = "metadata-patch-text-hint";
        textHint.textContent = loc("metadataPatches_textHint");
        body.append(textLabel, text, textHint);

        const updateSummary = () => {
            summaryName.textContent = name.value || loc("metadataPatches_unnamed");
            summaryStatus.className = `badge metadata-patch-summary-status ${enabled.checked ? "text-bg-success" : "text-bg-secondary"}`;
            summaryStatus.textContent = loc(enabled.checked ? "metadataPatches_enabled" : "metadataPatches_disabled");
        };
        updateSummary();

        section.open = state.expandedPatches.get(patch) ?? false;
        section.addEventListener("toggle", () => state.expandedPatches.set(patch, section.open));
        section.append(summary, body);
        return section;
    }

    function renderPatchList(selector, list, emptyKey) {
        const target = find(selector);
        target.replaceChildren();
        if (!list.length) {
            const empty = document.createElement("div");
            empty.className = "metadata-patches-empty";
            empty.innerHTML = '<i class="bi bi-inbox" aria-hidden="true"></i>';
            const message = document.createElement("p");
            message.textContent = loc(emptyKey);
            empty.append(message);
            target.append(empty);
            return;
        }
        list.forEach((patch, index) => target.append(createEditor(list, patch, index, render)));
    }

    function renderAccounts() {
        const list = find("#metadata-patches-account-list");
        const query = find("#metadata-patches-account-search").value.trim().toLocaleLowerCase();
        list.replaceChildren();
        const accounts = state.accounts.filter(account => {
            const name = account.displayName ?? account.id;
            return name.toLocaleLowerCase().includes(query) || account.id.includes(query);
        });
        if (!accounts.length) {
            const empty = document.createElement("p");
            empty.className = "text-body-secondary p-2 mb-0";
            empty.textContent = loc("metadataPatches_accountEmpty");
            list.append(empty);
            return;
        }

        accounts.forEach(account => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "metadata-patches-account-item";
            button.classList.toggle("active", account.id === state.selectedId);
            button.disabled = state.busy;
            button.setAttribute("aria-pressed", account.id === state.selectedId ? "true" : "false");
            button.addEventListener("click", () => void selectAccount(account.id));

            const name = document.createElement("span");
            name.className = "metadata-patches-account-item-name";
            name.textContent = account.displayName ?? account.id;

            const badge = document.createElement("span");
            const blacklisted = state.metadataPatchBlacklist.includes(account.id);
            badge.className = `badge metadata-patches-account-item-count ${blacklisted ? "text-bg-danger" : account.hasCustomPatches ? "text-bg-primary" : "text-bg-secondary"}`;
            badge.textContent = blacklisted
                ? loc("metadataPatches_blacklisted")
                : String((state.accountPatches[account.id] ?? []).length);
            button.append(name, badge);
            list.append(button);
        });
    }

    function render() {
        renderPatchList("#metadata-patches-list", state.globalPatches, "metadataPatches_empty");
        find("#metadata-patches-global-count").textContent = formatCount(state.globalPatches.length);
        renderAccounts();

        const account = selectedAccount();
        find("#metadata-patches-account-empty").classList.toggle("d-none", Boolean(account));
        find("#metadata-patches-account-form").classList.toggle("d-none", !account);
        if (account) {
            find("#metadata-patches-account-name").textContent = account.displayName ?? account.id;
            find("#metadata-patches-account-id").textContent = account.id;
            find("#metadata-patches-account-count").textContent = formatCount(selectedPatches().length);

            const blacklist = find("#metadata-patches-account-blacklist");
            blacklist.checked = selectedAccountIsBlacklisted();
            blacklist.disabled = state.busy;
            find("#metadata-patches-blacklist-note").classList.toggle("d-none", !blacklist.checked);
            renderPatchList("#metadata-patches-account-list-editor", selectedPatches(), "metadataPatches_empty");
        }

        const accountImport = find("#metadata-patches-account-import");
        accountImport.disabled = state.busy || !account;
        find("#metadata-patches-global-import").disabled = state.busy;
        find("#metadata-patches-global-add").disabled = state.busy;
        find("#metadata-patches-account-add").disabled = state.busy || !account;

        const accountTarget = find("#metadata-patches-import-target option[value='account']");
        accountTarget.disabled = !account;
        accountTarget.textContent = account
            ? `${loc("metadataPatches_selectedAccount")}: ${account.displayName ?? account.id}`
            : loc("metadataPatches_selectedAccount");

        renderPreview();
        renderSaveState();
    }

    async function selectAccount(id) {
        if (state.busy || id === state.selectedId) return;
        if (state.dirty && !window.confirm(loc("metadataPatches_unsavedConfirm"))) return;

        state.selectedId = id;
        state.dirty = false;
        state.revision = "";
        render();
        void loadSelectedPreview();
    }

    async function loadSelectedPreview() {
        const requestId = ++state.previewRequest;
        const selectedId = state.selectedId;
        if (!selectedId) return;
        try {
            const data = await window.metadataPatchApi.list(selectedId);
            if (requestId !== state.previewRequest || selectedId !== state.selectedId) return;
            state.sources = data.sources ?? [];
            state.revision = data.revision ?? "";
            renderPreview();
        } catch (error) {
            if (requestId !== state.previewRequest || selectedId !== state.selectedId) return;
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    function validate(list) {
        const invalidIndex = list.findIndex(patch => !patch.text.trim());
        if (invalidIndex !== -1) {
            toast(loc("metadataPatches_invalidText").replace("|INDEX|", String(invalidIndex + 1)), "danger");
            return false;
        }
        return true;
    }

    async function load() {
        const data = await window.metadataPatchApi.list();
        state.globalPatches = (data.patches ?? []).map(normalize);
        state.accountPatches = Object.fromEntries(
            Object.entries(data.accountMetadataPatches ?? {}).map(([id, patches]) => [id, patches.map(normalize)])
        );
        state.metadataPatchBlacklist = data.metadataPatchBlacklist ?? [];
        state.accounts = data.accounts ?? [];
        state.selectedId = state.accounts[0]?.id ?? null;
        state.sources = data.sources ?? [];
        state.revision = data.revision ?? "";
        state.dirty = false;
        render();
        await loadSelectedPreview();
    }

    function addGlobalPatch() {
        const patch = { name: "", enabled: true, text: "" };
        state.globalPatches.push(patch);
        state.expandedPatches.set(patch, true);
        markDirty();
        render();
    }

    function addAccountPatch() {
        if (!state.selectedId) return;
        state.accountPatches[state.selectedId] ??= [];
        const patch = { name: "", enabled: true, text: "" };
        state.accountPatches[state.selectedId].push(patch);
        state.expandedPatches.set(patch, true);
        markDirty();
        render();
    }

    function openImport(target) {
        if (state.busy) return;
        const account = selectedAccount();
        state.importTarget = target === "account" && account ? "account" : "global";
        const targetSelect = find("#metadata-patches-import-target");
        const text = find("#metadata-patches-import-text");
        const error = find("#metadata-patches-import-error");
        targetSelect.value = state.importTarget;
        text.value = "";
        text.classList.remove("is-invalid");
        error.textContent = "";
        if (!state.importModal && window.bootstrap?.Modal) {
            state.importModal = window.bootstrap.Modal.getOrCreateInstance(find("#metadata-patches-import-modal"));
        }
        if (!state.importModal) {
            toast(loc("metadataPatches_importUnavailable"), "danger");
            return;
        }
        state.importModal.show();
    }

    function importPatches() {
        const text = find("#metadata-patches-import-text");
        const error = find("#metadata-patches-import-error");
        const value = text.value;
        text.classList.remove("is-invalid");
        error.textContent = "";

        try {
            const parsed = metadataPatchText.parse(value, key => loc(key));
            if (!parsed.length) throw new Error(loc("metadataPatches_importEmpty"));
            const patches = parsed.map(normalize);
            const list = state.importTarget === "account" ? selectedPatches() : state.globalPatches;
            if (state.importTarget === "account" && !state.selectedId)
                throw new Error(loc("metadataPatches_accountNoSelection"));
            patches.forEach(patch => {
                list.push(patch);
                state.expandedPatches.set(patch, true);
            });
            markDirty();
            render();
            state.importModal?.hide();
            toast(loc("metadataPatches_imported").replace("|COUNT|", String(patches.length)), "success");
        } catch (importError) {
            text.classList.add("is-invalid");
            error.textContent = importError.message || String(importError);
        }
    }

    find("#metadata-patches-global-add").addEventListener("click", addGlobalPatch);
    find("#metadata-patches-account-add").addEventListener("click", addAccountPatch);
    find("#metadata-patches-global-import").addEventListener("click", () => openImport("global"));
    find("#metadata-patches-account-import").addEventListener("click", () => openImport("account"));
    find("#metadata-patches-import-target").addEventListener("change", event => {
        state.importTarget = event.target.value;
    });
    find("#metadata-patches-import-text").addEventListener("input", event => {
        event.target.classList.remove("is-invalid");
        find("#metadata-patches-import-error").textContent = "";
    });
    find("#metadata-patches-import-submit").addEventListener("click", importPatches);
    find("#metadata-patches-account-search").addEventListener("input", renderAccounts);
    find("#metadata-patches-account-blacklist").addEventListener("change", event => {
        if (!state.selectedId) return;
        const accountId = state.selectedId;
        if (event.target.checked) {
            if (!state.metadataPatchBlacklist.includes(accountId)) state.metadataPatchBlacklist.push(accountId);
        } else {
            state.metadataPatchBlacklist = state.metadataPatchBlacklist.filter(id => id !== accountId);
        }
        markDirty();
        render();
    });
    find("#metadata-patches-copy").addEventListener("click", async () => {
        const compiled = compiledPreview();
        if (!compiled) {
            toast(loc("metadataPatches_emptyPreview"), "warning");
            return;
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(compiled);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = compiled;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.append(textarea);
                textarea.select();
                if (!document.execCommand("copy")) throw new Error("copy failed");
                textarea.remove();
            }
            toast(loc("metadataPatches_copied"), "success");
        } catch {
            toast(loc("metadataPatches_copyFailed"), "danger");
        }
    });
    find("#metadata-patches-save").addEventListener("click", async () => {
        if (state.busy || !state.dirty) return;
        if (!validate(state.globalPatches) || !validate(selectedPatches())) return;

        state.busy = true;
        render();
        try {
            const accountMetadataPatches = Object.fromEntries(
                Object.entries(state.accountPatches).filter(([, patches]) => patches.length)
            );
            const data = await window.metadataPatchApi.save(
                state.globalPatches,
                accountMetadataPatches,
                state.metadataPatchBlacklist,
                state.selectedId
            );
            state.globalPatches = (data.patches ?? []).map(normalize);
            state.accountPatches = Object.fromEntries(
                Object.entries(data.accountMetadataPatches ?? {}).map(([id, patches]) => [id, patches.map(normalize)])
            );
            state.metadataPatchBlacklist = data.metadataPatchBlacklist ?? [];
            state.accounts = data.accounts ?? state.accounts;
            state.sources = data.sources ?? [];
            state.revision = data.revision ?? "";
            state.dirty = false;
            toast(loc("metadataPatches_saved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        } finally {
            state.busy = false;
            render();
        }
    });

    single.getRoute("/webui/metadata-patches").on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                if (applyServerConfig(await getServerConfig())) await load();
            })
            .catch(error => toast(error.responseText || loc("settings_changeFailed"), "danger"));
    });
})();
