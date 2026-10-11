(() => {
    const route = "/webui/world-activities";
    const root = document.querySelector(`[data-route='${route}']`);
    const find = selector => root.querySelector(selector);

    const setNotice = (message, danger = false) => {
        const notice = find("#world-activities-notice");
        notice.textContent = message || "";
        notice.className = `alert ${danger ? "alert-danger" : "alert-info"} ${message ? "" : "d-none"}`;
    };

    const formatDate = value => {
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date.toLocaleString() : "-";
    };

    const render = data => {
        const invasion = data.invasion;
        find("#world-activities-mode").textContent = loc(`worldActivities_${invasion.mode}`);
        find("#world-activities-source").textContent = loc(`worldActivities_${invasion.source}`);
        find("#world-activities-rotation").textContent = formatDate(invasion.rotation.startedAt);
        find("#world-activities-settles").textContent = formatDate(invasion.rotation.settlesAt);
        const body = find("#world-activities-invasions");
        body.replaceChildren();
        invasion.invasions.forEach(item => {
            const row = document.createElement("tr");
            const progress = item.goal > 0 ? `${Math.round((Math.abs(item.count) / item.goal) * 100)}%` : "-";
            row.innerHTML = `<td>${item.node}</td><td>${item.faction} / ${item.defenderFaction}</td><td>${progress}</td><td>${
                item.completed ? loc("worldActivities_completed") : loc("worldActivities_active")
            }</td>`;
            body.append(row);
        });
        if (data.config) {
            find("#worldState.invasionMode").value = data.config.invasionMode;
            find("#worldState.invasionRotationHours").value = data.config.invasionRotationHours;
            find("#worldState.invasionMaxDurationHours").value = data.config.invasionMaxDurationHours;
        }
    };

    const load = refresh =>
        $.ajax({
            url: `/custom/admin/world-activities${refresh ? "/refresh" : ""}?${window.authz}`,
            method: refresh ? "POST" : "GET"
        })
            .done(data => {
                render(data);
                setNotice("");
            })
            .fail(response => setNotice(response.responseText || loc("settings_changeFailed"), true));

    find("#world-activities-refresh").addEventListener("click", () => void load(true));
    single.getRoute(route).on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                const isAdmin = applyServerConfig(await getServerConfig());
                if (isAdmin) load(false);
            })
            .catch(error => setNotice(error.responseText || loc("settings_changeFailed"), true));
    });
})();
