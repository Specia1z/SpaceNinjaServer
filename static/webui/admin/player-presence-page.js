(() => {
    const root = document.querySelector("[data-route='/webui/player-presence']");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const stateIcons = {
        online: "bi-person-check",
        mission: "bi-controller",
        lobby: "bi-people",
        offline: "bi-moon",
        authenticating: "bi-shield-check",
        hub: "bi-globe2",
        relay: "bi-broadcast",
        unknown: "bi-question-circle"
    };
    let players = [];
    let listRequestId = 0;
    let historyRequestId = 0;
    let selectedAccountId;
    let searchTimer;

    const setError = message => {
        const error = find("#admin-presence-error");
        error.textContent = message || "";
        error.classList.toggle("d-none", !message);
    };

    const formatLocation = player => {
        if (player.NodeName || player.Node) {
            return [player.Planet, player.NodeName || player.Node].filter(Boolean).join(" / ");
        }
        return player.State == "offline" ? loc("admin_playerPresenceUnknown") : loc("admin_playerPresenceNotReported");
    };

    const formatSession = player => {
        if (!player.SessionId) return "";
        const count = player.SessionMemberCount
            ? loc("admin_playerPresencePlayerCount").replace("|COUNT|", player.SessionMemberCount)
            : "";
        return [player.SessionId.slice(0, 8), count].filter(Boolean).join(" · ");
    };

    const formatMissionStatus = status => (status ? loc("admin_playerPresenceMissionStatus_" + status) : "");

    const stateBadge = state => {
        const badge = document.createElement("span");
        const stateClass =
            {
                online: "text-bg-success",
                mission: "text-bg-primary",
                lobby: "text-bg-info",
                offline: "text-bg-secondary",
                authenticating: "text-bg-warning"
            }[state] || "text-bg-secondary";
        badge.className = `badge player-presence-state-badge ${stateClass}`;
        const icon = document.createElement("i");
        icon.className = `bi ${stateIcons[state] || stateIcons.unknown}`;
        icon.setAttribute("aria-hidden", "true");
        badge.append(icon, document.createTextNode(loc("admin_playerPresenceState_" + state)));
        return badge;
    };

    const setLoading = loading => {
        const button = find("#admin-presence-refresh");
        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
    };

    const updateSummary = summary => {
        find("#admin-presence-summary-value").textContent = `${summary.Online ?? 0} / ${summary.Total ?? 0}`;
        find("#admin-presence-online").textContent = summary.Online ?? 0;
        find("#admin-presence-total").textContent = summary.Total ?? 0;
        find("#admin-presence-mission").textContent = summary.InMission ?? 0;
        find("#admin-presence-sessions").textContent = summary.InSession ?? 0;
    };

    const updateSelectedRow = () => {
        root.querySelectorAll("[data-account-id]").forEach(row => {
            row.classList.toggle("is-selected", row.dataset.accountId == selectedAccountId);
        });
    };

    function render() {
        const selectedState = find("#admin-presence-state").value;
        const visible = players.filter(player => !selectedState || player.State == selectedState);
        const tbody = find("#admin-presence-players");
        tbody.replaceChildren();
        find("#admin-presence-filter-summary").textContent = `${visible.length} / ${players.length}`;
        find("#admin-presence-empty").classList.toggle("d-none", visible.length > 0);

        for (const player of visible) {
            const row = tbody.insertRow();
            row.dataset.accountId = player.AccountId;
            row.tabIndex = 0;
            row.addEventListener("click", () => void loadHistory(player));
            row.addEventListener("keydown", event => {
                if (event.key == "Enter" || event.key == " ") {
                    event.preventDefault();
                    void loadHistory(player);
                }
            });

            const account = row.insertCell();
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-link p-0 text-start player-presence-account";
            button.textContent = player.DisplayName;
            button.addEventListener("click", event => {
                event.stopPropagation();
                void loadHistory(player);
            });
            account.append(button);
            row.insertCell().append(stateBadge(player.State));
            row.insertCell().textContent = formatLocation(player);
            row.insertCell().textContent = formatSession(player);
            row.insertCell().textContent = [player.MissionType, formatMissionStatus(player.MissionStatus)]
                .filter(Boolean)
                .join(" · ");
            row.insertCell().textContent = [player.BuildLabel, player.ClientType].filter(Boolean).join(" · ");
            row.insertCell().textContent = player.LastSeenAt ? formatAdminDate(player.LastSeenAt) : loc("admin_never");
        }
        updateSelectedRow();
    }

    const clearHistory = () => {
        historyRequestId++;
        selectedAccountId = undefined;
        find("#admin-presence-history-name").textContent = "";
        find("#admin-presence-history").replaceChildren();
        find("#admin-presence-history-empty").classList.add("d-none");
        find("#admin-presence-clear-history").disabled = true;
        updateSelectedRow();
    };

    async function loadHistory(player) {
        const current = ++historyRequestId;
        selectedAccountId = player.AccountId;
        find("#admin-presence-history-name").textContent = `— ${player.DisplayName}`;
        find("#admin-presence-clear-history").disabled = false;
        find("#admin-presence-history-empty").classList.add("d-none");
        find("#admin-presence-history").replaceChildren();
        updateSelectedRow();

        try {
            const data = await window.playerPresenceApi.history(player.AccountId);
            if (current != historyRequestId) return;
            const events = data.Events ?? [];
            const tbody = find("#admin-presence-history");
            for (const event of events) {
                const row = tbody.insertRow();
                row.insertCell().textContent = formatAdminDate(event.CreatedAt);
                row.insertCell().textContent = event.Type || loc("admin_playerPresenceState_unknown");
                row.insertCell().textContent = [event.Planet, event.NodeName || event.Node].filter(Boolean).join(" / ");
                row.insertCell().textContent =
                    formatMissionStatus(event.MissionStatus) ||
                    (event.State ? loc("admin_playerPresenceState_" + event.State) : "");
            }
            find("#admin-presence-history-empty").classList.toggle("d-none", events.length > 0);
        } catch (error) {
            if (current != historyRequestId) return;
            setError(error.responseText || error.message || loc("settings_changeFailed"));
        }
    }

    async function load() {
        const current = ++listRequestId;
        setLoading(true);
        try {
            const data = await window.playerPresenceApi.list(find("#admin-presence-search").value);
            if (current != listRequestId) return;
            players = data.Players ?? [];
            updateSummary(data.Summary ?? { Total: players.length });
            render();
            find("#admin-presence-refresh-time").textContent =
                `${loc("admin_playerPresenceRefreshTime")} ${formatAdminDate(data.GeneratedAt)}`;
            setError("");
        } catch (error) {
            if (current != listRequestId) return;
            setError(error.responseText || error.message || loc("settings_changeFailed"));
        } finally {
            if (current == listRequestId) setLoading(false);
        }
    }

    find("#admin-presence-refresh").addEventListener("click", () => void load());
    find("#admin-presence-clear-history").addEventListener("click", clearHistory);
    find("#admin-presence-state").addEventListener("change", render);
    find("#admin-presence-search").addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => void load(), 250);
    });

    single.getRoute("/webui/player-presence").on("beforeload", () => {
        void awaitAuthz()
            .then(() => getServerConfig())
            .then(config => {
                if (!applyServerConfig(config)) return;
                return load();
            })
            .catch(error => setError(error.responseText || error.message || loc("settings_changeFailed")));
    });

    window.setInterval(() => {
        if (single.getCurrentPath() == "/webui/player-presence" && window.is_admin) void load();
    }, 15000);
})();
