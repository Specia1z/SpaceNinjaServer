(() => {
    const root = document.querySelector("[data-route='/webui/pluto-scripts']");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const state = {
        globalScripts: [],
        accountScripts: {},
        accountBlacklist: [],
        accounts: [],
        selectedId: null,
        dirty: false,
        busy: false,
        expandedScripts: new WeakMap(),
        savedGlobalScripts: [],
        savedAccountScripts: {},
        savedAccountBlacklist: []
    };
    const scriptNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

    const selectedAccount = () => state.accounts.find(account => account.id === state.selectedId);
    const selectedScripts = () => (state.selectedId ? (state.accountScripts[state.selectedId] ??= []) : []);
    const selectedAccountIsBlacklisted = () =>
        Boolean(state.selectedId && state.accountBlacklist.includes(state.selectedId));
    const formatCount = count => `${count} ${loc("plutoScripts_count")}`;

    const markDirty = () => {
        state.dirty = true;
        renderSaveState();
    };

    const renderSaveState = () => {
        const status = find("#pluto-scripts-save-status");
        const saveState = find("#pluto-scripts-save-state");
        const saveButton = find("#pluto-scripts-save");
        const statusKey = state.busy
            ? "plutoScripts_savingStatus"
            : state.dirty
              ? "plutoScripts_unsavedStatus"
              : "plutoScripts_savedStatus";
        status.textContent = loc(statusKey);
        saveState.classList.toggle("is-dirty", state.dirty);
        saveButton.disabled = state.busy || !state.dirty;
    };

    const createActionButton = (icon, title, handler, disabled, destructive = false) => {
        const button = document.createElement("button");
        button.className = `btn btn-sm pluto-script-action ${destructive ? "btn-outline-danger" : "btn-outline-secondary"}`;
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
    };

    const move = (list, index, delta, rerender) => {
        const next = index + delta;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
        markDirty();
        rerender();
    };

    const remove = (list, index, rerender) => {
        list.splice(index, 1);
        markDirty();
        rerender();
    };

    const createEditor = (list, script, index, rerender) => {
        const section = document.createElement("details");
        section.className = "pluto-script-editor";

        const summary = document.createElement("summary");
        summary.className = "pluto-script-summary";

        const order = document.createElement("span");
        order.className = "badge text-bg-secondary pluto-script-order";
        order.textContent = String(index + 1);

        const summaryName = document.createElement("span");
        summaryName.className = "pluto-script-summary-name";

        const summaryStatus = document.createElement("span");
        summaryStatus.className = "badge pluto-script-summary-status";
        summary.append(order, summaryName, summaryStatus);

        const body = document.createElement("div");
        body.className = "pluto-script-editor-body";

        const toolbar = document.createElement("div");
        toolbar.className = "pluto-script-editor-toolbar";

        const enabledWrap = document.createElement("div");
        enabledWrap.className = "form-check form-switch pluto-script-enabled";
        const enabled = document.createElement("input");
        enabled.className = "form-check-input";
        enabled.type = "checkbox";
        enabled.checked = script.enabled !== false;
        enabled.disabled = state.busy;
        const enabledLabel = document.createElement("label");
        enabledLabel.className = "form-check-label";
        enabledLabel.textContent = loc("plutoScripts_enabled");
        enabledWrap.append(enabled, enabledLabel);
        toolbar.append(enabledWrap);

        const actions = [
            [icons.angleUp, "plutoScripts_moveUp", () => move(list, index, -1, rerender), index === 0, false],
            [
                icons.angleDown,
                "plutoScripts_moveDown",
                () => move(list, index, 1, rerender),
                index === list.length - 1,
                false
            ],
            [icons.trash, "plutoScripts_delete", () => remove(list, index, rerender), false, true]
        ];
        actions.forEach(([icon, title, handler, disabled, destructive]) => {
            toolbar.append(createActionButton(icon, title, handler, disabled, destructive));
        });
        body.append(toolbar);

        const nameLabel = document.createElement("label");
        nameLabel.className = "form-label";
        nameLabel.textContent = loc("plutoScripts_name");
        const name = document.createElement("input");
        name.className = "form-control font-monospace pluto-script-name";
        name.type = "text";
        name.maxLength = 128;
        name.value = script.name;
        name.placeholder = loc("plutoScripts_namePlaceholder");
        name.disabled = state.busy;
        name.addEventListener("input", () => {
            script.name = name.value;
            markDirty();
            updateSummary();
        });
        body.append(nameLabel, name);

        const sourceLabel = document.createElement("label");
        sourceLabel.className = "form-label";
        sourceLabel.textContent = loc("plutoScripts_source");
        const source = document.createElement("textarea");
        source.className = "form-control font-monospace pluto-script-source";
        source.rows = 16;
        source.value = script.source;
        source.disabled = state.busy;
        source.spellcheck = false;
        source.addEventListener("input", () => {
            script.source = source.value;
            markDirty();
        });
        body.append(sourceLabel, source);

        const updateSummary = () => {
            summaryName.textContent = name.value || loc("plutoScripts_unnamed");
            summaryStatus.className = `badge pluto-script-summary-status ${enabled.checked ? "text-bg-success" : "text-bg-secondary"}`;
            summaryStatus.textContent = loc(enabled.checked ? "plutoScripts_enabled" : "plutoScripts_disabled");
        };
        enabled.addEventListener("change", () => {
            script.enabled = enabled.checked;
            markDirty();
            updateSummary();
        });
        updateSummary();

        section.open = state.expandedScripts.get(script) ?? false;
        section.addEventListener("toggle", () => state.expandedScripts.set(script, section.open));
        section.append(summary, body);
        return section;
    };

    const renderScriptList = (selector, list) => {
        const target = find(selector);
        target.replaceChildren();
        if (!list.length) {
            const empty = document.createElement("div");
            empty.className = "pluto-scripts-empty";
            empty.innerHTML = '<i class="bi bi-inbox" aria-hidden="true"></i>';
            const message = document.createElement("p");
            message.textContent = loc("plutoScripts_empty");
            empty.append(message);
            target.append(empty);
            return;
        }
        list.forEach((script, index) => target.append(createEditor(list, script, index, () => render())));
    };

    const renderAccounts = () => {
        const list = find("#pluto-scripts-account-list");
        const query = find("#pluto-scripts-account-search").value.trim().toLocaleLowerCase();
        list.replaceChildren();
        const accounts = state.accounts.filter(account => {
            const name = account.displayName ?? account.id;
            return name.toLocaleLowerCase().includes(query) || account.id.includes(query);
        });
        if (!accounts.length) {
            const empty = document.createElement("p");
            empty.className = "text-body-secondary p-2 mb-0";
            empty.textContent = loc("plutoScripts_accountEmpty");
            list.append(empty);
            return;
        }

        accounts.forEach(account => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "pluto-scripts-account-item";
            button.classList.toggle("active", account.id === state.selectedId);
            button.disabled = state.busy;
            button.setAttribute("aria-pressed", account.id === state.selectedId ? "true" : "false");
            button.addEventListener("click", () => selectAccount(account.id));

            const name = document.createElement("span");
            name.className = "pluto-scripts-account-item-name";
            name.textContent = account.displayName ?? account.id;

            const badge = document.createElement("span");
            const blacklisted = state.accountBlacklist.includes(account.id);
            const count = state.accountScripts[account.id]?.length ?? account.scriptCount ?? 0;
            badge.className = `badge pluto-scripts-account-item-count ${blacklisted ? "text-bg-danger" : count ? "text-bg-primary" : "text-bg-secondary"}`;
            badge.textContent = blacklisted ? loc("plutoScripts_blacklisted") : String(count);
            button.append(name, badge);
            list.append(button);
        });
    };

    const render = () => {
        renderScriptList("#pluto-scripts-global-list", state.globalScripts);
        find("#pluto-scripts-global-count").textContent = formatCount(state.globalScripts.length);
        renderAccounts();

        const account = selectedAccount();
        find("#pluto-scripts-account-empty").classList.toggle("d-none", Boolean(account));
        find("#pluto-scripts-account-form").classList.toggle("d-none", !account);
        if (account) {
            find("#pluto-scripts-account-name").textContent = account.displayName ?? account.id;
            find("#pluto-scripts-account-id").textContent = account.id;
            find("#pluto-scripts-account-count").textContent = formatCount(selectedScripts().length);
            const blacklist = find("#pluto-scripts-account-blacklist");
            blacklist.checked = selectedAccountIsBlacklisted();
            blacklist.disabled = state.busy;
            find("#pluto-scripts-blacklist-note").classList.toggle("d-none", !blacklist.checked);
            renderScriptList("#pluto-scripts-account-list-editor", selectedScripts());
        }

        find("#pluto-scripts-global-add").disabled = state.busy;
        find("#pluto-scripts-account-add").disabled = state.busy || !account;
        renderSaveState();
    };

    const selectAccount = id => {
        if (state.busy || id === state.selectedId) return;
        if (state.dirty && !window.confirm(loc("plutoScripts_unsavedConfirm"))) return;
        if (state.dirty) discardChanges();
        state.selectedId = id;
        state.dirty = false;
        render();
    };

    const normalize = script => ({
        name: script.name ?? "",
        source: script.source ?? "",
        enabled: script.enabled !== false
    });

    const cloneScripts = scripts => scripts.map(script => ({ ...script }));

    const captureSavedState = () => {
        state.savedGlobalScripts = cloneScripts(state.globalScripts);
        state.savedAccountScripts = Object.fromEntries(
            Object.entries(state.accountScripts).map(([id, scripts]) => [id, cloneScripts(scripts)])
        );
        state.savedAccountBlacklist = [...state.accountBlacklist];
    };

    const discardChanges = () => {
        state.globalScripts = cloneScripts(state.savedGlobalScripts);
        state.accountScripts = Object.fromEntries(
            Object.entries(state.savedAccountScripts).map(([id, scripts]) => [id, cloneScripts(scripts)])
        );
        state.accountBlacklist = [...state.savedAccountBlacklist];
    };

    const load = async () => {
        const data = await window.plutoScriptsApi.list();
        state.globalScripts = (data.scripts ?? []).map(normalize);
        state.accountScripts = Object.fromEntries(
            Object.entries(data.accountScripts ?? {}).map(([id, scripts]) => [id, scripts.map(normalize)])
        );
        state.accountBlacklist = data.accountBlacklist ?? [];
        state.accounts = data.accounts ?? [];
        state.selectedId = data.selectedAccountId || state.accounts[0]?.id || null;
        captureSavedState();
        state.dirty = false;
        render();
    };

    const validateScripts = scripts => {
        const names = new Set();
        for (const [index, script] of scripts.entries()) {
            if (!script.name.trim() || !scriptNamePattern.test(script.name.trim()) || names.has(script.name.trim())) {
                toast(loc("plutoScripts_invalidName").replace("|INDEX|", String(index + 1)), "danger");
                return false;
            }
            if (!script.source.trim()) {
                toast(loc("plutoScripts_invalidSource").replace("|INDEX|", String(index + 1)), "danger");
                return false;
            }
            names.add(script.name.trim());
        }
        return true;
    };

    find("#pluto-scripts-global-add").addEventListener("click", () => {
        const script = { name: "new-script", source: "", enabled: true };
        state.globalScripts.push(script);
        state.expandedScripts.set(script, true);
        markDirty();
        render();
    });

    find("#pluto-scripts-account-add").addEventListener("click", () => {
        if (!state.selectedId) return;
        const script = { name: "new-script", source: "", enabled: true };
        selectedScripts().push(script);
        state.expandedScripts.set(script, true);
        markDirty();
        render();
    });

    find("#pluto-scripts-account-search").addEventListener("input", renderAccounts);
    find("#pluto-scripts-account-blacklist").addEventListener("change", event => {
        if (!state.selectedId) return;
        if (event.target.checked) {
            if (!state.accountBlacklist.includes(state.selectedId)) state.accountBlacklist.push(state.selectedId);
        } else {
            state.accountBlacklist = state.accountBlacklist.filter(id => id !== state.selectedId);
        }
        markDirty();
        render();
    });

    find("#pluto-scripts-save").addEventListener("click", async () => {
        if (state.busy || !state.dirty) return;
        if (!validateScripts(state.globalScripts)) return;
        if (!Object.values(state.accountScripts).every(validateScripts)) return;

        state.busy = true;
        render();
        try {
            const accountScripts = Object.fromEntries(
                Object.entries(state.accountScripts).filter(([, scripts]) => scripts.length)
            );
            const data = await window.plutoScriptsApi.save(
                state.globalScripts,
                accountScripts,
                state.accountBlacklist,
                state.selectedId
            );
            state.globalScripts = (data.scripts ?? []).map(normalize);
            state.accountScripts = Object.fromEntries(
                Object.entries(data.accountScripts ?? {}).map(([id, scripts]) => [id, scripts.map(normalize)])
            );
            state.accountBlacklist = data.accountBlacklist ?? [];
            state.accounts = data.accounts ?? state.accounts;
            state.selectedId = data.selectedAccountId || state.selectedId;
            captureSavedState();
            state.dirty = false;
            toast(loc("plutoScripts_saved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        } finally {
            state.busy = false;
            render();
        }
    });

    single.getRoute("/webui/pluto-scripts").on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                if (applyServerConfig(await getServerConfig())) await load();
            })
            .catch(error => toast(error.responseText || loc("settings_changeFailed"), "danger"));
    });
})();
