(() => {
    const root = document.querySelector("[data-route='/webui/metadata-patches']");
    const find = selector => root.querySelector(selector);
    const state = {
        rawPatches: "",
        globalPatches: [],
        accountPatches: {},
        accounts: [],
        selectedId: null,
        sources: [],
        revision: "",
        dirty: false,
        busy: false
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

    function effectivePatches() {
        return [...state.globalPatches, ...selectedPatches()];
    }

    function getSources() {
        const rawOffset = state.rawPatches ? 1 : 0;
        const sources = state.rawPatches
            ? [
                  {
                      order: 1,
                      source: "global",
                      sourceLabel: loc("metadataPatches_globalSource"),
                      name: loc("metadataPatches_rawSource"),
                      enabled: true,
                      targets: []
                  }
              ]
            : [];
        return sources.concat(
            effectivePatches().map((patch, index) => ({
                order: index + 1 + rawOffset,
                source: index < state.globalPatches.length ? "global" : "account",
                sourceLabel:
                    index < state.globalPatches.length
                        ? loc("metadataPatches_globalSource")
                        : `${loc("metadataPatches_accountSource")} ${state.selectedId ?? ""}`,
                name: patch.name,
                enabled: patch.enabled !== false,
                targets: patch.targets ?? []
            }))
        );
    }

    function compiledPreview() {
        const structured = metadataPatchText.preview(effectivePatches());
        if (!state.rawPatches) return structured;
        if (!structured) return state.rawPatches;
        return `${state.rawPatches}${state.rawPatches.endsWith("\n") ? "\n" : "\n\n"}${structured}`;
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
            empty.className = "text-body-secondary mb-0";
            empty.textContent = loc("metadataPatches_emptyPreview");
            list.append(empty);
            return;
        }
        for (const source of sources) {
            const row = document.createElement("div");
            row.className = "metadata-patches-source-row";
            const order = document.createElement("span");
            order.className = "badge text-bg-secondary";
            order.textContent = String(source.order);
            const label = document.createElement("span");
            label.className = "metadata-patches-source-label";
            label.textContent = source.sourceLabel;
            const name = document.createElement("span");
            name.className = "metadata-patches-source-name";
            name.textContent = source.name || loc("metadataPatches_unnamed");
            const status = document.createElement("span");
            status.className = `badge ${source.enabled ? "text-bg-success" : "text-bg-secondary"}`;
            status.textContent = loc(source.enabled ? "metadataPatches_enabled" : "metadataPatches_disabled");
            row.append(order, label, name, status);
            list.append(row);
        }
    }

    function markDirty() {
        state.dirty = true;
        state.revision = "";
        renderPreview();
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

    function createEditor(list, patch, index, rerender) {
        const section = document.createElement("section");
        section.className = "metadata-patch-editor";

        const header = document.createElement("div");
        header.className = "d-flex flex-wrap align-items-center gap-2 mb-3";
        const enabledWrap = document.createElement("div");
        enabledWrap.className = "form-check form-switch me-auto";
        const enabled = document.createElement("input");
        enabled.className = "form-check-input";
        enabled.type = "checkbox";
        enabled.checked = patch.enabled !== false;
        enabled.addEventListener("change", () => update(list, index, "enabled", enabled.checked));
        const enabledLabel = document.createElement("label");
        enabledLabel.className = "form-check-label";
        enabledLabel.textContent = loc("metadataPatches_enabled");
        enabledWrap.append(enabled, enabledLabel);
        header.append(enabledWrap);

        const actions = [
            [icons.angleUp, "metadataPatches_moveUp", () => move(list, index, -1, rerender), index == 0, false],
            [
                icons.angleDown,
                "metadataPatches_moveDown",
                () => move(list, index, 1, rerender),
                index == list.length - 1,
                false
            ],
            [icons.trash, "metadataPatches_delete", () => remove(list, index, rerender), false, true]
        ];
        actions.forEach(([icon, title, handler, disabled, destructive]) => {
            const button = document.createElement("button");
            button.className = `btn btn-sm ${destructive ? "btn-outline-danger" : "btn-outline-secondary"}`;
            button.type = "button";
            button.innerHTML = icon;
            button.title = loc(title);
            button.setAttribute("aria-label", loc(title));
            button.disabled = disabled || state.busy;
            button.addEventListener("click", handler);
            header.append(button);
        });
        section.append(header);

        const nameLabel = document.createElement("label");
        nameLabel.className = "form-label";
        nameLabel.textContent = loc("metadataPatches_name");
        const name = document.createElement("input");
        name.className = "form-control mb-3";
        name.type = "text";
        name.maxLength = 200;
        name.value = patch.name;
        name.disabled = state.busy;
        name.addEventListener("input", () => update(list, index, "name", name.value.trim()));
        section.append(nameLabel, name);

        const textLabel = document.createElement("label");
        textLabel.className = "form-label";
        textLabel.textContent = loc("metadataPatches_textLabel");
        const text = document.createElement("textarea");
        text.className = "form-control";
        text.rows = 12;
        text.value = patch.text;
        text.placeholder = loc("metadataPatches_importPlaceholder");
        text.disabled = state.busy;
        text.addEventListener("input", () => update(list, index, "text", text.value));
        const textHint = document.createElement("div");
        textHint.className = "form-text";
        textHint.textContent = loc("metadataPatches_textHint");
        section.append(textLabel, text, textHint);
        return section;
    }

    function renderPatchList(selector, list, emptyKey) {
        const target = find(selector);
        target.replaceChildren();
        if (!list.length) {
            const empty = document.createElement("p");
            empty.className = "text-body-secondary mb-0";
            empty.textContent = loc(emptyKey);
            target.append(empty);
            return;
        }
        list.forEach((patch, index) => target.append(createEditor(list, patch, index, render)));
    }

    function renderAccounts() {
        const list = find("#metadata-patches-account-list");
        const query = find("#metadata-patches-account-search").value.trim().toLocaleLowerCase();
        list.replaceChildren();
        const accounts = state.accounts.filter(
            account => account.displayName.toLocaleLowerCase().includes(query) || account.id.includes(query)
        );
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
            button.addEventListener("click", () => selectAccount(account.id));
            const name = document.createElement("span");
            name.className = "metadata-patches-account-item-name";
            name.textContent = account.displayName;
            const badge = document.createElement("span");
            badge.className = `badge ${account.hasCustomPatches ? "text-bg-primary" : "text-bg-secondary"}`;
            badge.textContent = String((state.accountPatches[account.id] ?? []).length);
            button.append(name, badge);
            list.append(button);
        });
    }

    function render() {
        const rawEditor = find("#metadata-patches-raw");
        if (document.activeElement !== rawEditor) rawEditor.value = state.rawPatches;
        rawEditor.disabled = state.busy;
        renderPatchList("#metadata-patches-list", state.globalPatches, "metadataPatches_empty");
        renderAccounts();
        const account = selectedAccount();
        find("#metadata-patches-account-empty").classList.toggle("d-none", Boolean(account));
        find("#metadata-patches-account-form").classList.toggle("d-none", !account);
        if (account) {
            find("#metadata-patches-account-name").textContent = account.displayName;
            find("#metadata-patches-account-id").textContent = account.id;
            find("#metadata-patches-account-count").textContent =
                `${selectedPatches().length} ${loc("metadataPatches_count")}`;
            renderPatchList("#metadata-patches-account-list-editor", selectedPatches(), "metadataPatches_empty");
        }
        renderPreview();
    }

    function selectAccount(id) {
        if (state.busy || id === state.selectedId) return;
        if (state.dirty && !window.confirm(loc("metadataPatches_unsavedConfirm"))) return;
        state.selectedId = id;
        state.dirty = false;
        state.revision = "";
        render();
        void loadSelectedPreview();
    }

    async function loadSelectedPreview() {
        if (!state.selectedId) return;
        try {
            const data = await window.metadataPatchApi.list(state.selectedId);
            state.sources = data.sources ?? [];
            state.revision = data.revision ?? "";
            renderPreview();
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    function validate(list) {
        const invalidIndex = list.findIndex(patch => !patch.text.trim());
        if (invalidIndex != -1) {
            toast(loc("metadataPatches_invalidText").replace("|INDEX|", String(invalidIndex + 1)), "danger");
            return false;
        }
        return true;
    }

    async function load() {
        const data = await window.metadataPatchApi.list();
        state.rawPatches = data.rawPatches ?? "";
        state.globalPatches = (data.patches ?? []).map(normalize);
        state.accountPatches = Object.fromEntries(
            Object.entries(data.accountMetadataPatches ?? {}).map(([id, patches]) => [id, patches.map(normalize)])
        );
        state.accounts = data.accounts ?? [];
        state.selectedId = state.accounts[0]?.id ?? null;
        state.sources = data.sources ?? [];
        state.revision = data.revision ?? "";
        state.dirty = false;
        render();
        await loadSelectedPreview();
    }

    function addGlobalPatch() {
        state.globalPatches.push({ name: "", enabled: true, text: "" });
        markDirty();
        render();
    }
    find("#metadata-patches-add").addEventListener("click", addGlobalPatch);
    find("#metadata-patches-global-add").addEventListener("click", addGlobalPatch);
    find("#metadata-patches-account-add").addEventListener("click", () => {
        if (!state.selectedId) return;
        state.accountPatches[state.selectedId] ??= [];
        state.accountPatches[state.selectedId].push({ name: "", enabled: true, text: "" });
        markDirty();
        render();
    });
    find("#metadata-patches-raw").addEventListener("input", event => {
        state.rawPatches = event.target.value;
        markDirty();
    });
    find("#metadata-patches-account-search").addEventListener("input", renderAccounts);
    find("[data-loc='metadataPatches_copy']").addEventListener("click", async () => {
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
        if (!validate(state.globalPatches) || !validate(selectedPatches())) return;
        const button = find("#metadata-patches-save");
        button.disabled = true;
        state.busy = true;
        render();
        try {
            const accountMetadataPatches = Object.fromEntries(
                Object.entries(state.accountPatches).filter(([, patches]) => patches.length)
            );
            const data = await window.metadataPatchApi.save(
                state.rawPatches,
                state.globalPatches,
                accountMetadataPatches,
                state.selectedId
            );
            state.rawPatches = data.rawPatches ?? "";
            state.globalPatches = (data.patches ?? []).map(normalize);
            state.accountPatches = Object.fromEntries(
                Object.entries(data.accountMetadataPatches ?? {}).map(([id, patches]) => [id, patches.map(normalize)])
            );
            state.accounts = data.accounts ?? state.accounts;
            state.sources = data.sources ?? [];
            state.revision = data.revision ?? "";
            state.dirty = false;
            toast(loc("metadataPatches_saved"), "success");
            render();
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        } finally {
            state.busy = false;
            button.disabled = false;
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
