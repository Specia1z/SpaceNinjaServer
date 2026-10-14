(() => {
    const route = "/webui/world-state";
    const root = document.querySelector(`[data-route='${route}']`);
    const controlSelector = "input[id], select[id], textarea[id]";
    let initialized = false;

    if (!root) return;

    const find = selector => root.querySelector(selector);
    const getSections = () => [...root.querySelectorAll("[data-world-state-section]")];

    const getFieldContainer = control =>
        control.closest("form") || control.closest(".form-check, .form-group") || control.parentElement;

    const getFieldEntries = section => {
        const entries = new Map();
        section.querySelectorAll(controlSelector).forEach(control => {
            const field = getFieldContainer(control);
            if (!field) return;
            if (!entries.has(field)) entries.set(field, []);
            entries.get(field).push(control);
        });
        return [...entries.entries()].map(([field, controls]) => ({ field, controls }));
    };

    const getFieldText = field => {
        const labels = [...field.querySelectorAll("label")];
        return labels
            .map(label => label.textContent || label.dataset.loc || label.dataset.locItemMap || "")
            .join(" ")
            .trim()
            .toLocaleLowerCase();
    };

    const isControlActive = control => {
        if (control.type == "checkbox") return control.checked;
        if (control.classList.contains("tags-input")) return control.value.trim().length > 0;
        if (control.type == "datetime-local") return control.value.length > 0;
        const defaultValue = control.dataset.default;
        if (defaultValue === undefined) return control.value.length > 0;
        return control.value != defaultValue;
    };

    const updateStats = () => {
        const controls = [...root.querySelectorAll(`#world-state-card ${controlSelector}`)];
        const active = controls.filter(isControlActive).length;
        const liveSync = find("#worldState\\.liveSync");
        const syncStatus = find("#world-state-sync-status");

        find("#world-state-active-count").textContent = active;
        if (syncStatus) {
            syncStatus.textContent = loc(liveSync?.checked ? "enabled" : "disabled");
            syncStatus.closest(".world-state-stat-card")?.classList.toggle("is-active", !!liveSync?.checked);
        }
    };

    const updateFilter = () => {
        const filter = find("#world-state-filter");
        const query = filter?.value.trim().toLocaleLowerCase() || "";
        let visibleSections = 0;
        let visibleSettings = 0;

        getSections().forEach(section => {
            const sectionText = [
                ...section.querySelectorAll(".world-state-section-title, .world-state-section-description")
            ]
                .map(element => element.textContent || "")
                .join(" ")
                .toLocaleLowerCase();
            const sectionMatches = !query || sectionText.includes(query);
            const entries = getFieldEntries(section);
            let sectionHasVisibleFields = false;
            let sectionVisibleSettings = 0;

            entries.forEach(({ field, controls }) => {
                const matches = sectionMatches || !query || getFieldText(field).includes(query);
                field.classList.toggle("world-state-field-hidden", !matches);
                if (matches) {
                    sectionHasVisibleFields = true;
                    sectionVisibleSettings += controls.length;
                }
            });

            const visible = sectionMatches || sectionHasVisibleFields;
            section.classList.toggle("d-none", !visible);
            if (query && visible) section.open = true;
            if (visible) {
                visibleSections++;
                visibleSettings += sectionVisibleSettings;
            }
            section.querySelector("[data-section-count]").textContent = sectionVisibleSettings;
        });

        find("#world-state-section-count").textContent = visibleSections;
        find("#world-state-visible-count").textContent = visibleSettings;
        find("#world-state-no-results").classList.toggle("d-none", visibleSections > 0 || !query);
    };

    const refresh = () => {
        updateStats();
        updateFilter();
    };

    const bind = () => {
        if (initialized) return;
        initialized = true;

        find("#world-state-filter")?.addEventListener("input", updateFilter);
        find("#world-state-expand-all")?.addEventListener("click", () => {
            getSections().forEach(section => {
                if (!section.classList.contains("d-none")) section.open = true;
            });
        });
        find("#world-state-collapse-all")?.addEventListener("click", () => {
            getSections().forEach(section => {
                section.open = false;
            });
        });

        root.addEventListener("change", event => {
            if (event.target.matches(controlSelector)) refresh();
        });
        root.addEventListener("input", event => {
            if (event.target.matches(controlSelector)) refresh();
        });
        document.addEventListener("webui:translations-ready", () => {
            if (single.getCurrentPath() == route) refresh();
        });
        refresh();
    };

    bind();

    single.getRoute(route).on("beforeload", async () => {
        await awaitAuthz();
        applyServerConfig(await getServerConfig());
        refresh();
    });
})();
