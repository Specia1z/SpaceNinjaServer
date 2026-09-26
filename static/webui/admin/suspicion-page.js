(() => {
    const root = document.querySelector("[data-route='/webui/anti-cheat']");
    const find = selector => root.querySelector(selector);
    let selectedId;
    let detailRequestId = 0;
    let busy = false;

    const showError = error => toast(error.responseText || error.message || loc("settings_changeFailed"), "danger");
    const kindLabel = kind => loc("antiCheatKind_" + kind);
    const evidence = event =>
        Object.entries({
            requestId: event.RequestId,
            buildLabel: event.BuildLabel,
            missionStatus: event.MissionStatus,
            missionTime: event.MissionTime,
            aliveTime: event.AliveTime,
            enforced: event.Enforced,
            sessionId: event.SessionId,
            ...event.Details
        })
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(", ");

    function renderDetail(events) {
        const tbody = find("#admin-anti-cheat-events");
        tbody.replaceChildren();
        if (!events.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.className = "text-body-secondary";
            cell.textContent = loc("admin_noEvents");
            return;
        }
        for (const event of events) {
            const row = tbody.insertRow();
            row.insertCell().textContent = formatAdminDate(event.CreatedAt);
            row.insertCell().textContent = kindLabel(event.Kind);
            row.insertCell().textContent = event.MissionTag ?? "";
            row.insertCell().textContent = evidence(event);
        }
    }

    async function showDetail(entry) {
        const requestId = ++detailRequestId;
        selectedId = entry.AccountId;
        find("#admin-anti-cheat-detail-name").textContent = entry.DisplayName;
        find("#admin-anti-cheat-events").replaceChildren();
        try {
            const data = await window.suspicionApi.detail(entry.AccountId);
            if (requestId === detailRequestId) renderDetail(data.Events ?? []);
        } catch (error) {
            if (requestId === detailRequestId) showError(error);
        }
    }

    async function runAction(action) {
        if (busy) return;
        busy = true;
        find("#admin-anti-cheat-refresh").disabled = true;
        find("#admin-anti-cheat-clear-all").disabled = true;
        try {
            await action();
        } catch (error) {
            showError(error);
        } finally {
            busy = false;
            find("#admin-anti-cheat-refresh").disabled = false;
            find("#admin-anti-cheat-clear-all").disabled = false;
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
                detailRequestId++;
                find("#admin-anti-cheat-detail-name").textContent = "";
                find("#admin-anti-cheat-events").replaceChildren();
            }
            await load();
        });
    }

    function addAction(cell, label, style, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-sm ${style}`;
        button.textContent = loc(label);
        button.addEventListener("click", () => void onClick());
        cell.append(button);
    }

    function renderAccounts(data) {
        const accounts = data.Accounts ?? [];
        const summary = find("#admin-anti-cheat-summary");
        summary.classList.toggle("d-none", !data.TotalAccounts);
        summary.textContent = loc("admin_antiCheatSummary")
            .replaceAll("|ACCOUNTS|", String(data.TotalAccounts ?? 0))
            .replaceAll("|EVENTS|", String(data.TotalEvents ?? 0));
        find("#admin-anti-cheat-empty").classList.toggle("d-none", accounts.length > 0);
        const tbody = find("#admin-anti-cheat-accounts");
        tbody.replaceChildren();
        for (const entry of accounts) {
            const row = tbody.insertRow();
            row.insertCell().textContent = entry.DisplayName;
            row.insertCell().textContent = String(entry.Total);
            row.insertCell().textContent = Object.entries(entry.Counts ?? {})
                .map(([kind, count]) => `${kindLabel(kind)} x${count}`)
                .join(" / ");
            row.insertCell().textContent = formatAdminDate(entry.LastSeenAt);
            if (entry.Banned) {
                const badge = document.createElement("span");
                badge.className = "badge text-bg-danger";
                badge.textContent = loc("admin_banned");
                row.insertCell().append(badge);
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
            detailRequestId++;
            find("#admin-anti-cheat-detail-name").textContent = "";
            find("#admin-anti-cheat-events").replaceChildren();
        }
    }

    async function load() {
        renderAccounts(await window.suspicionApi.list());
    }

    find("#admin-anti-cheat-refresh").addEventListener("click", () => void runAction(load));
    find("#admin-anti-cheat-clear-all").addEventListener("click", () => void clear());
    single.getRoute("/webui/anti-cheat").on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                if (!applyServerConfig(await getServerConfig())) return;
                selectedId = undefined;
                detailRequestId++;
                find("#admin-anti-cheat-detail-name").textContent = "";
                find("#admin-anti-cheat-events").replaceChildren();
                await runAction(load);
            })
            .catch(showError);
    });
})();
