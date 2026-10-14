(() => {
    const currencyLabels = {
        RegularCredits: "currency_RegularCredits",
        PremiumCredits: "currency_PremiumCredits",
        PremiumCreditsFree: "currency_PremiumCreditsFree",
        FusionPoints: "currency_FusionPoints",
        CrewShipFusionPoints: "currency_CrewShipFusionPoints",
        PrimeTokens: "currency_PrimeTokens"
    };
    const itemsByType = new Map();
    let items = [];
    let loadedLanguage;
    let pendingLoad;

    const normalize = value =>
        String(value ?? "")
            .normalize("NFKD")
            .toLocaleLowerCase();

    function setItemLists(itemLists) {
        itemsByType.clear();
        for (const [category, entries] of Object.entries(itemLists ?? {})) {
            // AdditionalDict is UI copy (for example rank labels), not a grantable item list.
            if (category === "AdditionalDict" || !Array.isArray(entries)) continue;
            for (const entry of entries) {
                if (!entry || typeof entry.uniqueName !== "string" || typeof entry.name !== "string") continue;
                if (!itemsByType.has(entry.uniqueName)) {
                    itemsByType.set(entry.uniqueName, {
                        uniqueName: entry.uniqueName,
                        name: entry.name,
                        searchText: normalize(`${entry.name} ${entry.uniqueName} ${entry.subtype ?? ""}`)
                    });
                }
            }
        }

        for (const [uniqueName, label] of Object.entries(currencyLabels)) {
            const name = loc(label);
            itemsByType.set(uniqueName, {
                uniqueName,
                name,
                searchText: normalize(`${name} ${uniqueName}`),
                currency: true
            });
        }

        items = [...itemsByType.values()].sort((left, right) => left.name.localeCompare(right.name));
        return items;
    }

    async function load(language = window.lang ?? "en", force = false) {
        const normalizedLanguage = language || "en";
        if (!force && loadedLanguage === normalizedLanguage) return items;
        if (!force && pendingLoad?.language === normalizedLanguage) return pendingLoad.promise;

        const promise = window.adminDataApi.loadAddableItemLists(normalizedLanguage).then(itemLists => {
            setItemLists(itemLists);
            loadedLanguage = normalizedLanguage;
            return items;
        });
        pendingLoad = { language: normalizedLanguage, promise };
        try {
            return await promise;
        } finally {
            if (pendingLoad?.promise === promise) pendingLoad = undefined;
        }
    }

    function getLabel(uniqueName) {
        if (!uniqueName) return "";
        if (currencyLabels[uniqueName]) return loc(currencyLabels[uniqueName]);
        const entry = itemsByType.get(uniqueName);
        return entry?.name ? `${entry.name} (${uniqueName})` : uniqueName;
    }

    function setupPicker(inputId, resolvedId) {
        const input = document.getElementById(inputId);
        if (!input || input.dataset.pickerReady) return;
        input.dataset.pickerReady = "true";
        const resolved = resolvedId ? document.getElementById(resolvedId) : null;
        const list = document.createElement("div");
        list.className = "list-group admin-item-picker-results d-none";
        list.id = `${inputId}-results`;
        list.setAttribute("role", "listbox");
        input.setAttribute("aria-controls", list.id);
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.parentElement.classList.add("admin-item-picker");
        input.parentElement.append(list);

        let activeIndex = -1;
        let resultItems = [];
        let hideTimer;

        const updateResolved = () => {
            if (!resolved) return;
            const value = input.value.trim();
            const entry = itemsByType.get(value);
            resolved.textContent = !value
                ? ""
                : currencyLabels[value]
                  ? loc(currencyLabels[value])
                  : (entry?.name ?? loc("admin_itemUnknownName"));
        };

        const hideList = () => {
            list.classList.add("d-none");
            list.replaceChildren();
            resultItems = [];
            activeIndex = -1;
            input.setAttribute("aria-expanded", "false");
            input.removeAttribute("aria-activedescendant");
        };

        const setActive = index => {
            if (!resultItems.length) return;
            activeIndex = (index + resultItems.length) % resultItems.length;
            resultItems.forEach((option, optionIndex) => {
                option.classList.toggle("active", optionIndex === activeIndex);
                option.setAttribute("aria-selected", String(optionIndex === activeIndex));
            });
            input.setAttribute("aria-activedescendant", resultItems[activeIndex].id);
            resultItems[activeIndex].scrollIntoView({ block: "nearest" });
        };

        const choose = item => {
            input.value = item.uniqueName;
            updateResolved();
            hideList();
            input.dispatchEvent(new Event("change", { bubbles: true }));
        };

        const renderMatches = () => {
            clearTimeout(hideTimer);
            const query = normalize(input.value.trim());
            if (!query) return hideList();
            const matches = items
                .filter(item => item.searchText.includes(query))
                .sort((left, right) => {
                    const rank = item =>
                        normalize(item.uniqueName) === query
                            ? 0
                            : normalize(item.name).startsWith(query)
                              ? 1
                              : normalize(item.uniqueName).startsWith(query)
                                ? 2
                                : 3;
                    return rank(left) - rank(right) || left.name.localeCompare(right.name);
                })
                .slice(0, 40);
            if (!matches.length) return hideList();

            list.replaceChildren();
            resultItems = matches.map((item, index) => {
                const option = document.createElement("button");
                option.type = "button";
                option.id = `${list.id}-${index}`;
                option.className = "list-group-item list-group-item-action";
                option.setAttribute("role", "option");
                const name = document.createElement("span");
                name.className = "admin-item-picker-name";
                name.textContent = item.name;
                const path = document.createElement("span");
                path.className = "admin-item-picker-path font-monospace";
                path.textContent = item.uniqueName;
                option.append(name, path);
                option.addEventListener("mousedown", event => {
                    event.preventDefault();
                    choose(item);
                });
                list.append(option);
                return option;
            });
            list.classList.remove("d-none");
            input.setAttribute("aria-expanded", "true");
            activeIndex = -1;
            input.removeAttribute("aria-activedescendant");
        };

        input.addEventListener("input", () => {
            renderMatches();
            updateResolved();
        });
        input.addEventListener("focus", renderMatches);
        input.addEventListener("blur", () => {
            hideTimer = setTimeout(hideList, 150);
        });
        input.addEventListener("keydown", event => {
            if (event.key === "ArrowDown" && resultItems.length) {
                event.preventDefault();
                setActive(activeIndex + 1);
            } else if (event.key === "ArrowUp" && resultItems.length) {
                event.preventDefault();
                setActive(activeIndex < 0 ? resultItems.length - 1 : activeIndex - 1);
            } else if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                resultItems[activeIndex].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            } else if (event.key === "Escape") {
                hideList();
            }
        });
        updateResolved();
    }

    window.adminItemCatalog = {
        get items() {
            return items;
        },
        getLabel,
        load,
        setItemLists,
        setupPicker
    };
})();
