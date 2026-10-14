window.rewardStatsPage = (() => {
    const root = document.querySelector("[data-route='/webui/reward-stats']");
    if (!root) return { reset: () => {} };

    const find = selector => root.querySelector(selector);
    const state = { data: undefined, busy: false, requestId: 0 };

    const formatNumber = value => new Intl.NumberFormat().format(Number(value) || 0);
    const sourceLabel = source => {
        const key = `rewardStats_source_${source}`;
        const label = loc(key);
        return label === key ? source : label;
    };

    function notice(message, type = "danger") {
        const element = find("#reward-stats-notice");
        element.textContent = message;
        element.className = `alert alert-${type} reward-stats-notice`;
    }

    function clearNotice() {
        find("#reward-stats-notice").classList.add("d-none");
    }

    function appendCurrencyCell(row, value, icon) {
        const cell = row.insertCell();
        cell.className = "reward-stats-currency-cell";
        const iconElement = document.createElement("i");
        iconElement.className = `bi ${icon}`;
        iconElement.setAttribute("aria-hidden", "true");
        const text = document.createElement("span");
        text.textContent = formatNumber(value);
        cell.append(iconElement, text);
    }

    function renderAccounts() {
        const query = find("#reward-stats-search").value.trim().toLocaleLowerCase();
        const accounts = (state.data?.accounts ?? []).filter(
            account => !query || `${account.displayName} ${account.accountId}`.toLocaleLowerCase().includes(query)
        );
        const body = find("#reward-stats-accounts");
        body.replaceChildren();
        find("#reward-stats-visible-count").textContent = String(accounts.length);
        find("#reward-stats-accounts-empty").classList.toggle("d-none", accounts.length > 0);
        for (const account of accounts) {
            const row = body.insertRow();
            const accountCell = row.insertCell();
            accountCell.className = "reward-stats-account-cell";
            const name = document.createElement("strong");
            name.className = "reward-stats-account-name";
            name.textContent = account.displayName;
            const id = document.createElement("code");
            id.className = "reward-stats-account-id";
            id.textContent = account.accountId;
            accountCell.append(name, id);
            appendCurrencyCell(row, account.platinum, "bi-coin");
            appendCurrencyCell(row, account.regalAya, "bi-gem");
        }
    }

    function renderSourceMetric(source, key, labelKey, barClass, total) {
        const metric = document.createElement("div");
        metric.className = "reward-stats-source-metric";
        const heading = document.createElement("div");
        heading.className = "reward-stats-source-metric-head";
        const label = document.createElement("span");
        label.className = "reward-stats-source-metric-label";
        label.textContent = loc(labelKey);
        const value = document.createElement("strong");
        value.className = "reward-stats-source-metric-value";
        value.textContent = formatNumber(source[key]);
        heading.append(label, value);

        const progress = document.createElement("div");
        progress.className = "reward-stats-progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", String(total));
        progress.setAttribute("aria-valuenow", String(source[key] ?? 0));
        const bar = document.createElement("div");
        bar.className = `reward-stats-progress-bar ${barClass}`;
        bar.style.width = `${total ? Math.min(100, ((source[key] ?? 0) / total) * 100) : 0}%`;
        progress.append(bar);
        metric.append(heading, progress);
        return metric;
    }

    function renderSources() {
        const sources = state.data?.sources ?? [];
        const body = find("#reward-stats-sources");
        const totalPlatinum = Number(state.data?.totals?.platinum) || 0;
        const totalAya = Number(state.data?.totals?.regalAya) || 0;
        body.replaceChildren();
        find("#reward-stats-sources-empty").classList.toggle("d-none", sources.length > 0);
        for (const source of sources) {
            const item = document.createElement("article");
            item.className = "reward-stats-source-item";
            const header = document.createElement("header");
            header.className = "reward-stats-source-header";
            const name = document.createElement("strong");
            name.className = "reward-stats-source-name";
            name.textContent = sourceLabel(source.source);
            header.append(name);

            const metrics = document.createElement("div");
            metrics.className = "reward-stats-source-metrics";
            metrics.append(
                renderSourceMetric(source, "platinum", "rewardStats_platinum", "", totalPlatinum),
                renderSourceMetric(source, "regalAya", "rewardStats_aya", "reward-stats-progress-bar-aya", totalAya)
            );
            item.append(header, metrics);
            body.append(item);
        }
    }

    function render() {
        const accounts = state.data?.accounts ?? [];
        const sources = state.data?.sources ?? [];
        find("#reward-stats-admin").setAttribute("aria-busy", String(state.busy));
        find("#reward-stats-refresh").disabled = state.busy;
        find("#reward-stats-day").disabled = state.busy;
        find("#reward-stats-total-platinum").textContent = formatNumber(state.data?.totals?.platinum);
        find("#reward-stats-total-aya").textContent = formatNumber(state.data?.totals?.regalAya);
        find("#reward-stats-account-count").textContent = String(accounts.length);
        find("#reward-stats-source-count").textContent = String(sources.length);
        renderAccounts();
        renderSources();
    }

    function showAdmin(allowed) {
        find(".admin-hide").classList.toggle("d-none", allowed);
        find(".admin-show").classList.toggle("d-none", !allowed);
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
            clearNotice();
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

    function reset() {
        state.requestId++;
        state.data = undefined;
        state.busy = false;
        clearNotice();
        showAdmin(false);
        render();
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
