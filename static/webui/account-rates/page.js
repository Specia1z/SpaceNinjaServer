window.accountRatesPage = (() => {
    const root = document.querySelector("[data-route='/webui/account-rates']");
    const find = selector => root.querySelector(selector);
    const state = {
        accounts: [],
        definitions: [],
        selectedId: null,
        draft: null,
        dirty: false,
        busy: false,
        requestId: 0
    };
    const groupLabels = {
        mission: "accountRates_groupMission",
        progress: "accountRates_groupProgress",
        special: "accountRates_groupSpecial"
    };

    function notice(message, type = "danger") {
        const element = find("#account-rates-notice");
        element.textContent = message;
        element.className = `alert alert-${type}`;
    }

    function clearNotice() {
        find("#account-rates-notice").classList.add("d-none");
    }

    function selectedAccount() {
        return state.accounts.find(account => account.id === state.selectedId);
    }

    function renderList() {
        const list = find("#account-rates-accounts");
        const query = find("#account-rates-search").value.trim().toLocaleLowerCase();
        const accounts = state.accounts.filter(account => account.displayName.toLocaleLowerCase().includes(query));
        list.replaceChildren();
        if (!accounts.length) {
            const empty = document.createElement("p");
            empty.className = "account-rate-list-empty text-body-secondary";
            empty.textContent = loc("accountRates_noAccounts");
            list.append(empty);
            return;
        }
        for (const account of accounts) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "account-rate-account-item";
            button.classList.toggle("active", account.id === state.selectedId);
            button.setAttribute("aria-current", account.id === state.selectedId ? "true" : "false");
            button.disabled = state.busy;
            button.addEventListener("click", () => select(account.id));

            const name = document.createElement("span");
            name.className = "account-rate-account-name";
            name.textContent = account.displayName;
            const badge = document.createElement("span");
            badge.className = `badge ${account.hasCustomProfile ? "text-bg-primary" : "text-bg-secondary"}`;
            badge.textContent = account.hasCustomProfile ? loc("accountRates_custom") : "1x";
            button.append(name, badge);
            list.append(button);
        }
    }

    function renderFields() {
        const fields = find("#account-rates-fields");
        fields.replaceChildren();
        for (const [group, groupLabel] of Object.entries(groupLabels)) {
            const definitions = state.definitions.filter(definition => definition.group === group);
            if (!definitions.length) continue;
            const section = document.createElement("section");
            section.className = "account-rate-group";
            const heading = document.createElement("h5");
            heading.className = "account-rate-group-title";
            heading.textContent = loc(groupLabel);
            const grid = document.createElement("div");
            grid.className = "account-rate-field-grid";
            for (const definition of definitions) {
                const field = document.createElement("div");
                field.className = "account-rate-field";
                const label = document.createElement("label");
                label.className = "form-label";
                label.htmlFor = `account-rate-${definition.key}`;
                label.textContent = loc(definition.labelKey);
                const input = document.createElement("input");
                input.className = "form-control";
                input.id = label.htmlFor;
                input.type = "number";
                input.min = definition.min;
                input.max = definition.max;
                input.step = "any";
                input.value = state.draft[definition.key] ?? 1;
                input.disabled = state.busy;
                input.addEventListener("input", () => {
                    state.draft[definition.key] = input.value.trim() === "" ? NaN : Number(input.value);
                    state.dirty = true;
                    input.classList.remove("is-invalid");
                    clearNotice();
                });
                const hint = document.createElement("div");
                hint.className = "form-text";
                hint.textContent = loc(definition.descriptionKey);
                field.append(label, input, hint);
                grid.append(field);
            }
            section.append(heading, grid);
            fields.append(section);
        }
    }

    function render() {
        const selected = selectedAccount();
        find("#account-rates-summary").textContent =
            `${state.accounts.filter(a => a.hasCustomProfile).length}/${state.accounts.length} ${loc("accountRates_configured")}`;
        find("#account-rates-refresh").disabled = state.busy;
        renderList();
        find("#account-rates-empty").classList.toggle("d-none", Boolean(selected));
        find("#account-rates-form-wrap").classList.toggle("d-none", !selected);
        if (!selected) return;
        find("#account-rates-selected-name").textContent = selected.displayName;
        find("#account-rates-selected-id").textContent = selected.id;
        const enabled = find("#account-rates-enabled");
        enabled.checked = state.draft.enabled !== false;
        enabled.disabled = state.busy;
        for (const id of ["account-rates-save", "account-rates-reset", "account-rates-delete"]) {
            find(`#${id}`).disabled = state.busy;
        }
        renderFields();
    }

    function select(id) {
        if (state.busy || id === state.selectedId) return;
        if (state.dirty && !window.confirm(loc("accountRates_unsavedConfirm"))) return;
        const account = state.accounts.find(item => item.id === id);
        if (!account) return;
        state.selectedId = id;
        state.draft = { ...account.profile };
        state.dirty = false;
        clearNotice();
        render();
    }

    function showAdmin(allowed) {
        find(".admin-hide").classList.toggle("d-none", allowed);
        find(".admin-show").classList.toggle("d-none", !allowed);
    }

    async function load() {
        if (state.busy || (state.dirty && !window.confirm(loc("accountRates_unsavedConfirm")))) return;
        const requestId = ++state.requestId;
        state.busy = true;
        render();
        try {
            const data = await window.accountRatesApi.list();
            if (requestId !== state.requestId) return;
            state.accounts = data.accounts ?? [];
            state.definitions = data.definitions ?? [];
            if (!state.accounts.some(account => account.id === state.selectedId)) {
                state.selectedId = state.accounts[0]?.id ?? null;
            }
            state.draft = selectedAccount() ? { ...selectedAccount().profile } : null;
            state.dirty = false;
            showAdmin(true);
            clearNotice();
        } catch (error) {
            if (requestId !== state.requestId) return;
            showAdmin(error.status !== 401 && error.status !== 403);
            if (error.status !== 401 && error.status !== 403) notice(error.message);
        } finally {
            if (requestId === state.requestId) {
                state.busy = false;
                render();
            }
        }
    }

    async function mutate(request, onSuccess) {
        if (state.busy || !selectedAccount()) return;
        const requestId = state.requestId;
        state.busy = true;
        render();
        try {
            const result = await request();
            if (requestId === state.requestId) onSuccess(result);
        } catch (error) {
            if (requestId === state.requestId) notice(error.message);
        } finally {
            if (requestId === state.requestId) {
                state.busy = false;
                render();
            }
        }
    }

    function save() {
        if (!state.draft || state.busy) return;
        for (const definition of state.definitions) {
            const value = state.draft[definition.key];
            if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
                const input = find(`#account-rate-${definition.key}`);
                input.classList.add("is-invalid");
                input.focus();
                notice(loc("accountRates_invalidValue"));
                return;
            }
        }
        const account = selectedAccount();
        const profile = { ...state.draft };
        void mutate(
            () => window.accountRatesApi.save(account.id, profile),
            saved => {
                account.profile = saved.profile;
                account.hasCustomProfile = true;
                state.draft = { ...saved.profile };
                state.dirty = false;
                notice(loc("accountRates_saved"), "success");
            }
        );
    }

    function remove() {
        if (state.busy || !selectedAccount() || !window.confirm(loc("accountRates_deleteConfirm"))) return;
        const account = selectedAccount();
        void mutate(
            () => window.accountRatesApi.remove(account.id),
            () => {
                account.profile = Object.fromEntries([["enabled", true], ...state.definitions.map(d => [d.key, 1])]);
                account.hasCustomProfile = false;
                state.draft = { ...account.profile };
                state.dirty = false;
                notice(loc("accountRates_deleted"), "success");
            }
        );
    }

    function reset() {
        state.requestId++;
        state.accounts = [];
        state.definitions = [];
        state.selectedId = null;
        state.draft = null;
        state.busy = false;
        state.dirty = false;
        clearNotice();
        showAdmin(false);
    }

    find("#account-rates-search").addEventListener("input", renderList);
    find("#account-rates-refresh").addEventListener("click", () => void load());
    find("#account-rates-enabled").addEventListener("change", event => {
        state.draft.enabled = event.target.checked;
        state.dirty = true;
        clearNotice();
    });
    find("#account-rates-save").addEventListener("click", save);
    find("#account-rates-delete").addEventListener("click", remove);
    find("#account-rates-reset").addEventListener("click", () => {
        state.draft = Object.fromEntries([["enabled", true], ...state.definitions.map(d => [d.key, 1])]);
        state.dirty = true;
        clearNotice();
        render();
    });
    single.getRoute("/webui/account-rates").on("beforeload", () => void load());

    return { reset };
})();
