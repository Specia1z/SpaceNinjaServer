(() => {
    const root = document.querySelector("[data-route='/webui/anti-cheat']");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    let selectedId;
    let selectedEntry;
    let detailRequestId = 0;
    let busy = false;
    let accounts = [];
    let listData = { TotalAccounts: 0, TotalEvents: 0 };

    const riskLevel = score => (score >= 70 ? "high" : score >= 40 ? "medium" : "low");
    const kindLabel = kind => loc("antiCheatKind_" + kind);
    const responseLabel = response => loc("antiCheatResponse_" + (response || "observed"));
    const showError = error => toast(error.responseText || error.message || loc("settings_changeFailed"), "danger");

    const evidence = event =>
        Object.entries({
            requestId: event.RequestId,
            buildLabel: event.BuildLabel,
            missionStatus: event.MissionStatus,
            missionTime: event.MissionTime,
            aliveTime: event.AliveTime,
            enforced: event.Enforced,
            sessionId: event.SessionId,
            remoteAddress: event.RemoteAddress,
            ...event.Details
        })
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${key}=${typeof value == "object" ? JSON.stringify(value) : String(value)}`)
            .join(", ");

    const addBadge = (cell, text, style) => {
        const badge = document.createElement("span");
        badge.className = `badge rounded-pill ${style}`;
        badge.textContent = text;
        cell.append(badge);
        return badge;
    };

    const addAction = (cell, label, style, onClick) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-sm ${style}`;
        button.textContent = loc(label);
        button.addEventListener("click", () => void onClick());
        cell.append(button);
    };

    const activateTab = id => {
        const tab = find(id);
        if (tab) tab.click();
    };

    const setDetailPlaceholder = key => {
        const tbody = find("#admin-anti-cheat-events");
        tbody.replaceChildren();
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.className = "text-body-secondary text-center py-4";
        cell.textContent = loc(key);
    };

    const renderRisk = (cell, rawScore) => {
        const score = Math.max(0, Math.min(100, Number(rawScore) || 0));
        const level = riskLevel(score);
        cell.className = `admin-suspicion-risk ${level}`;
        const label = document.createElement("div");
        label.className = "d-flex justify-content-between gap-2";
        const name = document.createElement("span");
        name.textContent = loc("antiCheatRisk_" + level);
        const value = document.createElement("strong");
        value.textContent = String(score);
        label.append(name, value);
        const progress = document.createElement("div");
        progress.className = "progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
        progress.setAttribute("aria-valuenow", String(score));
        const bar = document.createElement("div");
        bar.className = "progress-bar";
        bar.style.width = `${score}%`;
        progress.append(bar);
        cell.append(label, progress);
    };

    const renderDetail = events => {
        const tbody = find("#admin-anti-cheat-events");
        tbody.replaceChildren();
        if (!events.length) {
            setDetailPlaceholder("admin_noEvents");
            return;
        }
        for (const event of events) {
            const row = tbody.insertRow();
            row.insertCell().textContent = formatAdminDate(event.CreatedAt);
            row.insertCell().textContent = kindLabel(event.Kind);
            renderRisk(row.insertCell(), event.RiskScore);
            const responseCell = row.insertCell();
            const response = event.Response || (event.Enforced ? "rejected" : "observed");
            const responseStyle =
                response == "rejected"
                    ? "text-bg-danger"
                    : response == "observed"
                      ? "text-bg-secondary"
                      : "text-bg-warning";
            addBadge(responseCell, responseLabel(response), responseStyle);
            row.insertCell().textContent = event.MissionTag ?? "";
            row.insertCell().textContent = evidence(event);
        }
    };

    const updateDetailHeader = entry => {
        const name = find("#admin-anti-cheat-detail-name");
        const risk = find("#admin-anti-cheat-detail-risk");
        name.textContent = entry?.DisplayName ?? "";
        if (!entry) {
            risk.classList.add("d-none");
            return;
        }
        risk.classList.remove("d-none");
        risk.textContent = `${loc("admin_antiCheatRisk")}: ${entry.RiskScore ?? 0}`;
        risk.classList.toggle("text-bg-danger", (entry.RiskScore ?? 0) >= 70);
        risk.classList.toggle("text-bg-warning", (entry.RiskScore ?? 0) >= 40 && (entry.RiskScore ?? 0) < 70);
        risk.classList.toggle("text-bg-secondary", (entry.RiskScore ?? 0) < 40);
    };

    async function showDetail(entry) {
        const requestId = ++detailRequestId;
        selectedId = entry.AccountId;
        selectedEntry = entry;
        updateDetailHeader(entry);
        activateTab("#admin-anti-cheat-tab-detail");
        setDetailPlaceholder("admin_antiCheatLoading");
        try {
            const data = await window.suspicionApi.detail(entry.AccountId);
            if (requestId === detailRequestId) renderDetail(data.Events ?? []);
        } catch (error) {
            if (requestId === detailRequestId) {
                setDetailPlaceholder("admin_antiCheatLoadFailed");
                showError(error);
            }
        }
    }

    async function runAction(action) {
        if (busy) return;
        busy = true;
        root.querySelectorAll("[data-suspicion-action]").forEach(button => {
            button.disabled = true;
        });
        try {
            await action();
        } catch (error) {
            showError(error);
        } finally {
            busy = false;
            root.querySelectorAll("[data-suspicion-action]").forEach(button => {
                button.disabled = false;
            });
        }
    }

    async function toggleBan(entry) {
        const banned = !entry.Banned;
        const prompt = loc(banned ? "admin_banConfirm" : "admin_unbanConfirm").replace("|TARGET|", entry.DisplayName);
        if (!confirm(prompt)) return;
        await runAction(async () => {
            await window.suspicionApi.ban(entry.AccountId, banned);
            toast(loc("admin_banDone").replace("|TARGET|", entry.DisplayName), "success");
            await load();
        });
    }

    async function clear(entry) {
        const prompt = entry
            ? loc("admin_clearEventsConfirm").replace("|TARGET|", entry.DisplayName)
            : loc("admin_clearAllEventsConfirm");
        if (!confirm(prompt)) return;
        await runAction(async () => {
            const result = await window.suspicionApi.clear(entry?.AccountId);
            toast(loc("admin_eventsCleared").replace("|COUNT|", String(result.Deleted ?? 0)), "success");
            if (!entry || selectedId === entry.AccountId) {
                selectedId = undefined;
                selectedEntry = undefined;
                detailRequestId++;
                updateDetailHeader(undefined);
                setDetailPlaceholder("admin_antiCheatDetailEmpty");
            }
            await load();
        });
    }

    const getFilteredAccounts = () => {
        const query = find("#admin-anti-cheat-search").value.trim().toLocaleLowerCase();
        const kind = find("#admin-anti-cheat-kind-filter").value;
        return accounts.filter(entry => {
            const matchesSearch =
                !query ||
                entry.DisplayName.toLocaleLowerCase().includes(query) ||
                Object.keys(entry.Counts ?? {}).some(key => kindLabel(key).toLocaleLowerCase().includes(query));
            const matchesKind = !kind || (entry.Counts?.[kind] ?? 0) > 0;
            return matchesSearch && matchesKind;
        });
    };

    const renderKindFilter = () => {
        const select = find("#admin-anti-cheat-kind-filter");
        const current = select.value;
        const kinds = [...new Set(accounts.flatMap(entry => Object.keys(entry.Counts ?? {})))].sort();
        select.replaceChildren();
        const all = document.createElement("option");
        all.value = "";
        all.textContent = loc("admin_antiCheatAllChecks");
        select.append(all);
        for (const kind of kinds) {
            const option = document.createElement("option");
            option.value = kind;
            option.textContent = kindLabel(kind);
            select.append(option);
        }
        select.value = kinds.includes(current) ? current : "";
    };

    function renderAccounts(data) {
        if (data.Accounts) accounts = data.Accounts;
        if (data.TotalAccounts !== undefined) listData.TotalAccounts = data.TotalAccounts;
        if (data.TotalEvents !== undefined) listData.TotalEvents = data.TotalEvents;
        const summary = find("#admin-anti-cheat-summary");
        summary.textContent = loc("admin_antiCheatSummary")
            .replaceAll("|ACCOUNTS|", String(listData.TotalAccounts))
            .replaceAll("|EVENTS|", String(listData.TotalEvents));
        renderKindFilter();
        const visibleAccounts = getFilteredAccounts();
        const empty = find("#admin-anti-cheat-empty");
        empty.classList.toggle("d-none", visibleAccounts.length > 0);
        empty.querySelector("span").textContent =
            accounts.length > 0 && visibleAccounts.length == 0
                ? loc("admin_antiCheatNoMatches")
                : loc("admin_antiCheatEmpty");
        const tbody = find("#admin-anti-cheat-accounts");
        tbody.replaceChildren();
        for (const entry of visibleAccounts) {
            const row = tbody.insertRow();
            row.classList.toggle("selected", entry.AccountId === selectedId);
            row.insertCell().textContent = entry.DisplayName;
            renderRisk(row.insertCell(), entry.RiskScore);
            row.insertCell().textContent = String(entry.Total);
            row.insertCell().textContent = Object.entries(entry.Counts ?? {})
                .map(([kind, count]) => `${kindLabel(kind)} x${count}`)
                .join(" / ");
            const responseCell = row.insertCell();
            const response = entry.LastResponse || "observed";
            const responseStyle =
                response == "rejected"
                    ? "text-bg-danger"
                    : response == "observed"
                      ? "text-bg-secondary"
                      : "text-bg-warning";
            addBadge(responseCell, responseLabel(response), responseStyle);
            row.insertCell().textContent = formatAdminDate(entry.LastSeenAt);
            if (entry.Banned) {
                addBadge(row.insertCell(), loc("admin_banned"), "text-bg-danger");
            } else {
                row.insertCell();
            }
            const actions = row.insertCell();
            actions.className = "admin-suspicion-actions";
            addAction(actions, "admin_antiCheatViewDetail", "btn-outline-secondary", () => showDetail(entry));
            addAction(
                actions,
                entry.Banned ? "admin_unban" : "admin_ban",
                entry.Banned ? "btn-outline-success" : "btn-outline-danger",
                () => toggleBan(entry)
            );
            addAction(actions, "admin_antiCheatClear", "btn-outline-secondary", () => clear(entry));
        }
        if (selectedId && !accounts.some(entry => entry.AccountId === selectedId)) {
            selectedId = undefined;
            selectedEntry = undefined;
            detailRequestId++;
            updateDetailHeader(undefined);
            setDetailPlaceholder("admin_antiCheatDetailEmpty");
        } else if (selectedEntry) {
            selectedEntry = accounts.find(entry => entry.AccountId === selectedId) ?? selectedEntry;
            updateDetailHeader(selectedEntry);
        }
    }

    const updateModeHint = () => {
        const mode = find("#antiCheat.responseMode").value || "observe";
        find("#admin-anti-cheat-mode-hint").textContent = loc("admin_antiCheatModeHint_" + mode);
    };

    async function load() {
        renderAccounts(await window.suspicionApi.list());
    }

    find("#admin-anti-cheat-search").addEventListener("input", () => renderAccounts({ Accounts: accounts }));
    find("#admin-anti-cheat-kind-filter").addEventListener("change", () => renderAccounts({ Accounts: accounts }));
    find("#antiCheat.responseMode").addEventListener("change", updateModeHint);
    find("#admin-anti-cheat-refresh").addEventListener("click", () => void runAction(load));
    find("#admin-anti-cheat-clear-all").addEventListener("click", () => void clear());
    single.getRoute("/webui/anti-cheat").on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                if (!applyServerConfig(await getServerConfig())) return;
                selectedId = undefined;
                selectedEntry = undefined;
                detailRequestId++;
                updateDetailHeader(undefined);
                setDetailPlaceholder("admin_antiCheatDetailEmpty");
                updateModeHint();
                await runAction(load);
            })
            .catch(showError);
    });
})();
