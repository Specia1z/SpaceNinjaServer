window.rewardStatsPage = (() => {
    const root = document.querySelector("[data-route='/webui/reward-stats']");
    if (!root) return { reset: () => {} };

    const find = selector => root.querySelector(selector);
    const state = { data: undefined, busy: false, requestId: 0 };

    const formatNumber = value => new Intl.NumberFormat().format(Number(value) || 0);
    const sourceLabel = source => loc(`rewardStats_source_${source}`) || source;

    function notice(message, type = "danger") {
        const element = find("#reward-stats-notice");
        element.textContent = message;
        element.className = `alert alert-${type} mt-3`;
    }

    function renderAccounts() {
        const query = find("#reward-stats-search").value.trim().toLocaleLowerCase();
        const accounts = (state.data?.accounts ?? []).filter(account =>
            account.displayName.toLocaleLowerCase().includes(query)
        );
        const body = find("#reward-stats-accounts");
        body.replaceChildren();
        find("#reward-stats-accounts-empty").classList.toggle("d-none", accounts.length > 0);
        for (const account of accounts) {
            const row = body.insertRow();
            row.insertCell().textContent = account.displayName;
            row.insertCell().textContent = formatNumber(account.platinum);
            row.insertCell().textContent = formatNumber(account.regalAya);
        }
    }

    function renderSources() {
        const body = find("#reward-stats-sources");
        body.replaceChildren();
        for (const source of state.data?.sources ?? []) {
            const row = body.insertRow();
            row.insertCell().textContent = sourceLabel(source.source);
            row.insertCell().textContent = formatNumber(source.platinum);
            row.insertCell().textContent = formatNumber(source.regalAya);
        }
    }

    function render() {
        find("#reward-stats-refresh").disabled = state.busy;
        find("#reward-stats-day").disabled = state.busy;
        find("#reward-stats-total-platinum").textContent = formatNumber(state.data?.totals?.platinum);
        find("#reward-stats-total-aya").textContent = formatNumber(state.data?.totals?.regalAya);
        renderAccounts();
        renderSources();
    }

    async function load() {
        if (state.busy) return;
        const requestId = ++state.requestId;
        state.busy = true;
        render();
        try {
            state.data = await window.rewardStatsApi.list(find("#reward-stats-day").value);
            if (requestId !== state.requestId) return;
            find("#reward-stats-day").value = state.data.day;
            find("#reward-stats-notice").classList.add("d-none");
            showAdmin(true);
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

    function showAdmin(allowed) {
        find(".admin-hide").classList.toggle("d-none", allowed);
        find(".admin-show").classList.toggle("d-none", !allowed);
    }

    function reset() {
        state.requestId++;
        state.data = undefined;
        state.busy = false;
        showAdmin(false);
    }

    const today = new Date();
    find("#reward-stats-day").value = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    find("#reward-stats-refresh").addEventListener("click", () => void load());
    find("#reward-stats-day").addEventListener("change", () => void load());
    find("#reward-stats-search").addEventListener("input", renderAccounts);
    single.getRoute("/webui/reward-stats").on("beforeload", () => void load());

    return { reset };
})();
