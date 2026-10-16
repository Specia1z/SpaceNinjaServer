(() => {
    const route = "/webui/world-activities";
    const root = document.querySelector(`[data-route='${route}']`);
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const state = {
        invasions: [],
        config: {},
        worldStateSources: null,
        requestId: 0,
        hasData: false
    };

    const setNotice = (message, danger = false) => {
        const notice = find("#world-activities-notice");
        notice.textContent = message || "";
        notice.className = `alert world-activities-notice ${danger ? "alert-danger" : "alert-info"} ${message ? "" : "d-none"}`;
    };

    const formatDate = value => {
        if (!value) return "—";
        const date = new Date(value);
        return Number.isFinite(date.getTime())
            ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
            : "—";
    };

    const localizeValue = value => {
        const key = `worldActivities_${value}`;
        const translated = loc(key);
        return translated === key ? value || "—" : translated;
    };

    const localizeSource = source => {
        if (!source) return loc("worldActivities_sourceUnavailable");
        return localizeValue(`source_${source.replaceAll(".", "_").replaceAll("-", "_")}`);
    };

    const renderSourceEntry = (prefix, entry) => {
        const source = find(`#world-activities-${prefix}-source`);
        const fetchedAt = find(`#world-activities-${prefix}-source-time`);
        const hasSource = Boolean(entry?.source);
        source.textContent = localizeSource(entry?.source);
        source.className = `world-activities-source-value ${hasSource ? "is-current" : "is-unavailable"}`;
        fetchedAt.textContent = entry?.lastSuccessAt
            ? loc("worldActivities_sourceLastUsed").replace("|DATE|", formatDate(entry.lastSuccessAt))
            : loc("worldActivities_sourceWaiting");
    };

    const renderWorldStateSources = sources => {
        const status = sources ?? {};
        renderSourceEntry("primary", status.primary);
        renderSourceEntry("supplemental", status.supplemental);
        find("#world-activities-source-attempt").textContent = status.lastAttemptAt
            ? formatDate(status.lastAttemptAt)
            : loc("worldActivities_sourceUnavailable");
        find("#world-activities-source-success").textContent = status.lastSuccessAt
            ? formatDate(status.lastSuccessAt)
            : loc("worldActivities_sourceUnavailable");

        const errors = [
            status.primary?.lastError ? `${loc("worldActivities_primarySource")}: ${status.primary.lastError}` : "",
            status.supplemental?.lastError
                ? `${loc("worldActivities_supplementalSource")}: ${status.supplemental.lastError}`
                : ""
        ].filter(Boolean);
        const error = find("#world-activities-source-error");
        error.textContent = errors.length
            ? loc("worldActivities_sourceError").replace("|ERROR|", errors.join(" · "))
            : "";
        error.classList.toggle("d-none", errors.length === 0);
    };

    const visibleInvasions = () => {
        const query = find("#world-activities-search").value.trim().toLocaleLowerCase();
        const filter = find("#world-activities-filter").value;
        return state.invasions.filter(item => {
            const completed = Boolean(item.completed);
            if ((filter === "completed" && !completed) || (filter === "active" && completed)) return false;
            if (!query) return true;
            return [
                item.node,
                item.nodeName,
                item.systemName,
                formatFaction(item.faction),
                formatFaction(item.defenderFaction)
            ]
                .filter(Boolean)
                .some(value => String(value).toLocaleLowerCase().includes(query));
        });
    };

    const formatFaction = faction => {
        if (!faction) return "—";
        const key = `worldActivities_faction_${faction.replace("FC_", "").toLocaleLowerCase()}`;
        const translated = loc(key);
        return translated === key ? faction : translated;
    };

    const renderSummary = invasion => {
        const invasions = invasion.invasions ?? [];
        const completed = invasions.filter(item => item.completed).length;
        const active = invasions.length - completed;
        find("#world-activities-active-count").textContent = String(active);
        find("#world-activities-completed-count").textContent = String(completed);
        find("#world-activities-mode").textContent = localizeValue(invasion.mode);
        find("#world-activities-source").textContent = localizeValue(invasion.source);

        const sourceBadge = find("#world-activities-source-badge");
        sourceBadge.textContent = localizeValue(invasion.source);
        sourceBadge.className = `badge world-activities-source-badge ${invasion.source === "local" ? "is-local" : "text-bg-primary"}`;

        find("#world-activities-rotation").textContent = formatDate(invasion.rotation?.startedAt);
        find("#world-activities-settles").textContent = formatDate(invasion.rotation?.settlesAt);
        find("#world-activities-rotation-hours").textContent = state.config.invasionRotationHours
            ? `${state.config.invasionRotationHours} ${loc("worldActivities_hoursUnit")}`
            : "—";
    };

    const makeProgress = item => {
        const wrapper = document.createElement("div");
        wrapper.className = "world-activities-progress";
        const value = item.completed
            ? 100
            : item.goal > 0 && Number.isFinite(item.count)
              ? Math.min(100, Math.max(0, Math.round((Math.abs(item.count) / item.goal) * 100)))
              : null;

        if (value === null) {
            const unavailable = document.createElement("span");
            unavailable.className = "text-body-secondary";
            unavailable.textContent = "—";
            wrapper.append(unavailable);
            return wrapper;
        }

        const progress = document.createElement("div");
        progress.className = "progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-label", loc("worldActivities_progress"));
        progress.setAttribute("aria-valuenow", String(value));
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
        const bar = document.createElement("div");
        bar.className = "progress-bar";
        bar.style.width = `${value}%`;
        progress.append(bar);

        const label = document.createElement("span");
        label.className = "world-activities-progress-value";
        label.textContent = `${value}%`;
        wrapper.append(progress, label);
        return wrapper;
    };

    const renderInvasions = () => {
        const body = find("#world-activities-invasions");
        const empty = find("#world-activities-empty");
        const noMatches = find("#world-activities-no-matches");
        const visible = visibleInvasions();
        body.replaceChildren();

        for (const item of visible) {
            const row = document.createElement("tr");
            const node = row.insertCell();
            node.className = "world-activities-node";
            const nodeName = document.createElement("strong");
            nodeName.textContent = [item.systemName, item.nodeName].filter(Boolean).join(" · ") || item.node || "—";
            const nodeMeta = document.createElement("small");
            nodeMeta.textContent = item.node || "";
            node.append(nodeName, nodeMeta);

            const factions = row.insertCell();
            factions.className = "world-activities-factions";
            factions.textContent =
                [formatFaction(item.faction), formatFaction(item.defenderFaction)].filter(Boolean).join(" / ") || "—";

            row.insertCell().append(makeProgress(item));

            const statusCell = row.insertCell();
            const status = document.createElement("span");
            status.className = `badge world-activities-status ${item.completed ? "text-bg-success" : "text-bg-warning"}`;
            const icon = document.createElement("i");
            icon.className = `bi ${item.completed ? "bi-check2-circle" : "bi-arrow-repeat"}`;
            icon.setAttribute("aria-hidden", "true");
            status.append(
                icon,
                document.createTextNode(loc(item.completed ? "worldActivities_completed" : "worldActivities_active"))
            );
            statusCell.append(status);

            body.append(row);
        }

        empty.classList.toggle("d-none", state.invasions.length > 0 || !state.hasData);
        noMatches.classList.toggle("d-none", state.invasions.length === 0 || visible.length > 0);
        const count = find("#world-activities-invasion-count");
        count.textContent = state.hasData
            ? loc("worldActivities_invasionCount")
                  .replace("|VISIBLE|", String(visible.length))
                  .replace("|TOTAL|", String(state.invasions.length))
            : loc("worldActivities_loading");
    };

    const render = data => {
        const invasion = data.invasion ?? data;
        if (data.config) {
            state.config = { ...state.config, ...data.config };
            find('[id="worldState.invasionMode"]').value = state.config.invasionMode;
            find('[id="worldState.invasionRotationHours"]').value = state.config.invasionRotationHours;
            find('[id="worldState.invasionMaxDurationHours"]').value = state.config.invasionMaxDurationHours;
        }
        state.invasions = invasion.invasions ?? [];
        if (data.worldStateSources) state.worldStateSources = data.worldStateSources;
        state.hasData = true;
        renderWorldStateSources(state.worldStateSources);
        renderSummary(invasion);
        renderInvasions();
        find("#world-activities-updated").textContent = `${loc("worldActivities_updated")} ${formatDate(Date.now())}`;
    };

    const setLoading = loading => {
        const button = find("#world-activities-refresh");
        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
        button.setAttribute("aria-busy", String(loading));
        const label = button.querySelector("span");
        label.textContent = loc(loading ? "worldActivities_refreshing" : "worldActivities_refresh");
        if (!state.hasData && loading) {
            const empty = find("#world-activities-empty");
            empty.classList.remove("d-none");
            empty.querySelector("p").textContent = loc("worldActivities_loading");
        }
    };

    const load = refresh => {
        const requestId = ++state.requestId;
        setLoading(true);
        return $.ajax({
            url: `/custom/admin/world-activities${refresh ? "/refresh" : ""}?${window.authz}&lang=${encodeURIComponent(window.lang ?? "en")}`,
            method: refresh ? "POST" : "GET"
        })
            .done(data => {
                if (requestId !== state.requestId) return;
                render(data);
                setNotice("");
            })
            .fail(response => {
                if (requestId !== state.requestId) return;
                setNotice(response.responseText || loc("settings_changeFailed"), true);
                if (!state.hasData) {
                    const empty = find("#world-activities-empty");
                    empty.classList.remove("d-none");
                    empty.querySelector("p").textContent = loc("worldActivities_loadFailed");
                }
            })
            .always(() => {
                if (requestId === state.requestId) setLoading(false);
            });
    };

    find("#world-activities-refresh").addEventListener("click", () => void load(true));
    find("#world-activities-search").addEventListener("input", renderInvasions);
    find("#world-activities-filter").addEventListener("change", renderInvasions);
    single.getRoute(route).on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                const isAdmin = applyServerConfig(await getServerConfig());
                if (isAdmin) void load(false);
            })
            .catch(error => setNotice(error.responseText || loc("settings_changeFailed"), true));
    });
})();
