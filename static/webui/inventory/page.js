(() => {
    const initializeInventoryPage = () => {
        const route = document.querySelector("[data-route='/webui/inventory']");
        const grid = route?.querySelector(".inventory-category-grid");
        const filters = route?.querySelector("#inventory-category-filters");
        const search = route?.querySelector("#inventory-category-search");
        if (!route || !grid || !filters || !search || route.dataset.inventoryInitialized) return;
        route.dataset.inventoryInitialized = "true";

        const initializeCategoryActions = () => {
            const addAction = (actions, key, icon, handler) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "btn btn-sm btn-outline-secondary";
                button.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
                button.dataset.locTitle = key;
                button.title = localize(key);
                button.setAttribute("aria-label", button.title);
                button.addEventListener("click", handler);
                actions.append(button);
            };

            grid.querySelectorAll(".card-header[data-cardtype]").forEach(header => {
                if (header.dataset.inventoryActionsReady) return;
                header.dataset.inventoryActionsReady = "true";
                const category = header.dataset.cardtype;
                header.replaceChildren();
                header.className = "card-header";

                const title = document.createElement("h5");
                title.className = "mb-0";
                title.dataset.loc = `inventory_${category.charAt(0).toLowerCase()}${category.slice(1)}`;
                title.innerHTML = localize(title.dataset.loc);
                const actions = document.createElement("div");
                actions.className = "d-flex gap-2";
                header.append(title, actions);

                if (!["MoaPets", "Hoverboards", "Boosters"].includes(category)) {
                    addAction(actions, "inventory_bulkAdd", "bi-plus-lg", event => {
                        event.preventDefault();
                        if (category === "EvolutionProgress") debounce(addMissingEvolutionProgress);
                        else debounce(addMissingEquipment, [category]);
                    });
                }
                if (!["QuestKeys", "Boosters", "FlavourItems", "ShipDecorations", "WeaponSkins"].includes(category)) {
                    addAction(actions, "inventory_bulkRankUp", "bi-arrow-up", event => {
                        event.preventDefault();
                        if (category === "EvolutionProgress") debounce(maxRankAllEvolutions);
                        else debounce(maxRankAllEquipment, [category]);
                    });
                }
                if (category === "QuestKeys") {
                    addAction(actions, "inventory_bulkComplete", "bi-check-lg", () => doBulkQuestUpdate("completeAll"));
                    addAction(actions, "inventory_bulkReset", "bi-arrow-counterclockwise", () =>
                        doBulkQuestUpdate("resetAll")
                    );
                }
                if (category !== "Boosters") {
                    addAction(actions, "inventory_bulkRemove", "bi-trash3", () => removeItems(category));
                }
            });
        };

        const localize = key => (typeof window.loc === "function" ? window.loc(key) : key);
        initializeCategoryActions();
        const categories = [...grid.querySelectorAll(".card-header[data-cardtype]")].map(header => {
            const card = header.closest(".card");
            const column = header.closest(".col-lg-6");
            const countBadge = document.createElement("span");
            countBadge.className = "inventory-category-count";
            const actions = header.querySelector(".d-flex");
            if (actions) header.insertBefore(countBadge, actions);
            else header.append(countBadge);
            return {
                type: header.dataset.cardtype,
                header,
                column,
                countBadge,
                rows: [...(card?.querySelectorAll("tbody") ?? [])].flatMap(body => [...body.rows])
            };
        });
        let activeCategory = "all";
        let chart;
        const totalElement = route.querySelector("#inventory-total-entries");
        const activeCategoriesElement = route.querySelector("#inventory-active-categories");
        const topCategoryElement = route.querySelector("#inventory-top-category");
        const canvas = route.querySelector("#inventory-category-chart");
        const chartEmpty = route.querySelector("#inventory-chart-empty");

        filters.setAttribute("aria-label", localize("inventory_allCategories"));
        if (canvas) canvas.setAttribute("aria-label", localize("inventory_chartTitle"));
        const searchClear = route.querySelector("#inventory-category-search-clear");
        if (searchClear) searchClear.setAttribute("aria-label", localize("inventory_clearSearch"));

        const makeFilter = (type, label, count) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `btn btn-sm rounded-pill inventory-filter-chip${activeCategory === type ? " btn-primary active" : " btn-outline-secondary"}`;
            button.dataset.inventoryCategory = type;
            button.setAttribute("aria-pressed", String(activeCategory === type));

            const text = document.createElement("span");
            text.textContent = label;
            const badge = document.createElement("span");
            badge.className = "inventory-filter-count";
            badge.textContent = count.toLocaleString();
            button.append(text, badge);
            button.addEventListener("click", () => {
                activeCategory = type;
                createCategoryFilters();
                applyFilters();
            });
            return button;
        };

        const createCategoryFilters = () => {
            filters.replaceChildren();
            const total = categories.reduce((sum, category) => sum + category.rows.length, 0);
            filters.append(makeFilter("all", localize("inventory_allCategories"), total));
            categories.forEach(category => {
                const label = category.header.querySelector("h5")?.textContent.trim() || category.type;
                const count = category.rows.length;
                const formattedCount = count.toLocaleString();
                if (category.countBadge.textContent !== formattedCount) category.countBadge.textContent = formattedCount;
                filters.append(makeFilter(category.type, label, count));
            });
        };

        const updateSummaryAndChart = () => {
            const counts = categories.map(category => ({
                category,
                label: category.header.querySelector("h5")?.textContent.trim() || category.type,
                count: category.rows.length
            }));
            const total = counts.reduce((sum, item) => sum + item.count, 0);
            const nonEmpty = counts.filter(item => item.count > 0);
            const top = [...counts].sort((left, right) => right.count - left.count)[0];
            if (totalElement) totalElement.textContent = total.toLocaleString();
            if (activeCategoriesElement) activeCategoriesElement.textContent = nonEmpty.length.toLocaleString();
            if (topCategoryElement) topCategoryElement.textContent = top?.count ? top.label : "—";

            if (!canvas || !window.Chart) return;
            if (!nonEmpty.length) {
                chart?.destroy();
                chart = undefined;
                chartEmpty?.classList.remove("d-none");
                return;
            }
            chartEmpty?.classList.add("d-none");
            const style = getComputedStyle(route);
            const textColor = style.getPropertyValue("--bs-secondary-color").trim() || "#adb5bd";
            const primaryRgb = style.getPropertyValue("--bs-primary-rgb").trim() || "13, 110, 253";
            const gridColor = style.getPropertyValue("--bs-border-color").trim() || "rgba(128, 128, 128, 0.18)";
            const labels = [...nonEmpty].sort((left, right) => right.count - left.count).slice(0, 7);
            const data = {
                labels: labels.map(item => item.label),
                datasets: [
                    {
                        data: labels.map(item => item.count),
                        backgroundColor: labels.map(
                            (_item, index) =>
                                `rgba(${primaryRgb}, ${index === 0 ? 1 : Math.max(0.42, 0.82 - index * 0.07)})`
                        ),
                        borderRadius: 5,
                        borderSkipped: false,
                        barThickness: 11
                    }
                ]
            };
            if (chart) {
                chart.data = data;
                chart.options.scales.x.ticks.color = textColor;
                chart.options.scales.y.ticks.color = textColor;
                chart.update("none");
                return;
            }
            chart = new window.Chart(canvas, {
                type: "bar",
                data,
                options: {
                    indexAxis: "y",
                    animation: { duration: 220 },
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { displayColors: false } },
                    scales: {
                        x: {
                            beginAtZero: true,
                            border: { display: false },
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0, font: { size: 10 } }
                        },
                        y: {
                            border: { display: false },
                            grid: { display: false },
                            ticks: { color: textColor, autoSkip: false, font: { size: 10 } }
                        }
                    }
                }
            });
        };

        const applyFilters = () => {
            const query = search.value.trim().toLocaleLowerCase();
            for (const category of categories) {
                const categoryLabel = category.header.querySelector("h5")?.textContent.toLocaleLowerCase() ?? "";
                const categoryMatchesQuery =
                    !query || categoryLabel.includes(query) || category.type.toLocaleLowerCase().includes(query);
                const categorySelected = activeCategory === "all" || activeCategory === category.type;
                let rowMatches = 0;
                for (const row of category.rows) {
                    const itemType = row.dataset.itemType?.toLocaleLowerCase() ?? "";
                    const rowMatchesQuery =
                        !query ||
                        categoryMatchesQuery ||
                        row.textContent.toLocaleLowerCase().includes(query) ||
                        itemType.includes(query);
                    row.classList.toggle("inventory-row-filtered", !rowMatchesQuery);
                    if (rowMatchesQuery) rowMatches += 1;
                }
                category.column?.classList.toggle(
                    "inventory-category-hidden",
                    !categorySelected || (!categoryMatchesQuery && rowMatches === 0)
                );
            }
        };

        search.addEventListener("input", applyFilters);
        route.querySelector("#inventory-category-search-clear")?.addEventListener("click", () => {
            search.value = "";
            search.focus();
            applyFilters();
        });
        createCategoryFilters();
        updateSummaryAndChart();
        applyFilters();

        const observer = new MutationObserver(() => {
            for (const category of categories) {
                category.rows = [...(category.header.closest(".card")?.querySelectorAll("tbody") ?? [])].flatMap(
                    body => [...body.rows]
                );
            }
            createCategoryFilters();
            updateSummaryAndChart();
            applyFilters();
            if (canvas) canvas.setAttribute("aria-label", localize("inventory_chartTitle"));
            if (searchClear) searchClear.setAttribute("aria-label", localize("inventory_clearSearch"));
        });
        observer.observe(grid, { childList: true, subtree: true });

        document.addEventListener("webui:translations-ready", () => {
            filters.setAttribute("aria-label", localize("inventory_allCategories"));
            createCategoryFilters();
            updateSummaryAndChart();
            if (canvas) canvas.setAttribute("aria-label", localize("inventory_chartTitle"));
            if (searchClear) searchClear.setAttribute("aria-label", localize("inventory_clearSearch"));
        });
    };

    if (window.dictPromise) window.dictPromise.then(initializeInventoryPage);
    else initializeInventoryPage();
})();
