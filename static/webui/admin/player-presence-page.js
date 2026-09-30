(() => {
    const root = document.querySelector("[data-route='/webui/player-presence']");
    if (!root) return;
    const find = selector => root.querySelector(selector);
    let players = [];
    let requestId = 0;

    const formatLocation = player => {
        if (player.NodeName || player.Node) {
            return [player.Planet, player.NodeName || player.Node].filter(Boolean).join(" / ");
        }
        return player.State == "offline" ? loc("admin_playerPresenceUnknown") : loc("admin_playerPresenceNotReported");
    };

    const formatSession = player => {
        if (!player.SessionId) return "";
        return [player.SessionId.slice(0, 8), player.SessionMemberCount ? `${player.SessionMemberCount} players` : ""]
            .filter(Boolean)
            .join(" · ");
    };

    const formatMissionStatus = status => (status ? loc("admin_playerPresenceMissionStatus_" + status) : "");

    const stateBadge = state => {
        const badge = document.createElement("span");
        badge.className = `badge ${state == "offline" ? "text-bg-secondary" : state == "mission" ? "text-bg-primary" : "text-bg-success"}`;
        badge.textContent = loc("admin_playerPresenceState_" + state);
        return badge;
    };

    function render() {
        const selectedState = find("#admin-presence-state").value;
        const visible = players.filter(player => !selectedState || player.State == selectedState);
        const tbody = find("#admin-presence-players");
        tbody.replaceChildren();
        find("#admin-presence-empty").classList.toggle("d-none", visible.length > 0);
        for (const player of visible) {
            const row = tbody.insertRow();
            const account = row.insertCell();
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-link btn-sm p-0 text-start";
            button.textContent = player.DisplayName;
            button.addEventListener("click", () => void loadHistory(player));
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
    }

    async function loadHistory(player) {
        const current = ++requestId;
        find("#admin-presence-history-name").textContent = player.DisplayName;
        const tbody = find("#admin-presence-history");
        tbody.replaceChildren();
        try {
            const data = await window.playerPresenceApi.history(player.AccountId);
            if (current !== requestId) return;
            for (const event of data.Events ?? []) {
                const row = tbody.insertRow();
                row.insertCell().textContent = formatAdminDate(event.CreatedAt);
                row.insertCell().textContent = event.Type;
                row.insertCell().textContent = [event.Planet, event.NodeName || event.Node].filter(Boolean).join(" / ");
                row.insertCell().textContent = formatMissionStatus(event.MissionStatus) || event.State;
            }
        } catch (error) {
            toast(error.responseText || error.message || loc("settings_changeFailed"), "danger");
        }
    }

    async function load() {
        const data = await window.playerPresenceApi.list(find("#admin-presence-search").value);
        players = data.Players ?? [];
        find("#admin-presence-summary").textContent = `${data.Summary?.Online ?? 0} / ${data.Summary?.Total ?? 0}`;
        render();
    }

    find("#admin-presence-refresh").addEventListener("click", () => void load());
    find("#admin-presence-state").addEventListener("change", render);
    find("#admin-presence-search").addEventListener("input", () => void load());
    single.getRoute("/webui/player-presence").on("beforeload", () => {
        void awaitAuthz()
            .then(() => getServerConfig())
            .then(config => {
                if (!applyServerConfig(config)) return;
                return load();
            })
            .catch(error => toast(error.responseText || error.message || loc("settings_changeFailed"), "danger"));
    });
    window.setInterval(() => {
        if (single.getCurrentPath() == "/webui/player-presence" && window.is_admin) void load();
    }, 15000);
})();
