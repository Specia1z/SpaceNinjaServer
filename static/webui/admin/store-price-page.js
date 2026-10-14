(() => {
    const state = {
        page: 1,
        pageSize: 50,
        search: "",
        request: 0,
        bundlePage: 1,
        bundlePageSize: 25,
        bundleRequest: 0,
        searchTimer: undefined,
        data: { items: [], page: 1, pageSize: 50, pageCount: 0, total: 0 },
        bundles: { items: [], page: 1, pageSize: 25, pageCount: 0, total: 0 }
    };

    const find = id => document.getElementById(id);

    const itemDisplayLabel = typeName => window.adminItemCatalog?.getLabel(typeName) ?? typeName;

    const optionalPrice = id => {
        const value = find(id).value;
        return value === "" ? undefined : Number(value);
    };

    let componentRowId = 0;

    const addBundleComponent = (component = {}) => {
        const container = find("admin-store-bundle-components");
        const row = document.createElement("div");
        row.className = "row g-2 mb-2 align-items-center";

        const typeColumn = document.createElement("div");
        typeColumn.className = "col-md-7";
        const typeInput = document.createElement("input");
        typeInput.className = "form-control font-monospace admin-store-bundle-component-type";
        typeInput.required = true;
        typeInput.autocomplete = "off";
        typeInput.placeholder = loc("admin_storeBundleComponentPlaceholder");
        typeInput.value = component.TypeName ?? "";
        typeInput.id = `admin-store-bundle-component-${++componentRowId}`;
        typeColumn.append(typeInput);

        const quantityColumn = document.createElement("div");
        quantityColumn.className = "col-md-2";
        const quantityInput = document.createElement("input");
        quantityInput.className = "form-control admin-store-bundle-component-quantity";
        quantityInput.type = "number";
        quantityInput.min = "1";
        quantityInput.max = "100";
        quantityInput.step = "1";
        quantityInput.required = true;
        quantityInput.value = component.PurchaseQuantity ?? 1;
        quantityInput.title = loc("admin_storeBundleComponentQuantity");
        quantityColumn.append(quantityInput);

        const durationColumn = document.createElement("div");
        durationColumn.className = "col-md-2";
        const durationInput = document.createElement("input");
        durationInput.className = "form-control admin-store-bundle-component-duration";
        durationInput.type = "number";
        durationInput.min = "3";
        durationInput.step = "1";
        durationInput.placeholder = loc("admin_storeBundleComponentDuration");
        durationInput.value = component.DurabilityDays ?? "";
        durationInput.title = loc("admin_storeBundleComponentDuration");
        durationColumn.append(durationInput);

        const actionColumn = document.createElement("div");
        actionColumn.className = "col-md-1 text-end";
        const remove = document.createElement("button");
        remove.className = "btn btn-sm btn-outline-danger";
        remove.type = "button";
        remove.textContent = loc("admin_removeComponent");
        remove.onclick = () => row.remove();
        actionColumn.append(remove);

        row.append(typeColumn, quantityColumn, durationColumn, actionColumn);
        container.append(row);
        window.adminDataPage?.setupItemPicker(typeInput.id);
    };

    const renderBundles = () => {
        const tbody = find("admin-store-bundles");
        tbody.replaceChildren();
        for (const bundle of state.bundles.items) {
            const row = tbody.insertRow();
            const itemCell = row.insertCell();
            itemCell.textContent = itemDisplayLabel(bundle.TypeName);
            const path = document.createElement("div");
            path.className = "small text-body-secondary text-break font-monospace";
            path.textContent = bundle.TypeName;
            itemCell.append(path);
            row.insertCell().textContent = bundle.Components.map(component => {
                const quantity = component.PurchaseQuantity > 1 ? ` x${component.PurchaseQuantity}` : "";
                return `${itemDisplayLabel(component.TypeName)}${quantity}`;
            }).join(", ");
            row.insertCell().textContent =
                bundle.Source === "supplemental"
                    ? loc("admin_storePriceSourceSupplemental")
                    : loc("admin_storePriceSourcePublicExport");
            const actions = row.insertCell();
            const edit = document.createElement("button");
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.textContent = loc("admin_edit");
            edit.onclick = () => editStoreBundle(bundle);
            actions.append(edit);
            if (bundle.Editable) {
                const remove = document.createElement("button");
                remove.className = "btn btn-sm btn-outline-danger";
                remove.textContent = loc("admin_delete");
                remove.onclick = () => deleteStoreBundle(bundle.TypeName);
                actions.append(remove);
            }
        }

        const pageCount = state.bundles.pageCount;
        find("admin-store-bundle-total").textContent = state.bundles.total.toLocaleString();
        find("admin-store-bundle-empty").classList.toggle("d-none", state.bundles.items.length > 0);
        find("admin-store-bundle-page-status").textContent = loc("admin_storeBundlePageStatus")
            .replace("|PAGE|", state.bundles.pageCount ? state.bundles.page : 0)
            .replace("|PAGES|", pageCount)
            .replace("|TOTAL|", state.bundles.total.toLocaleString());
        find("admin-store-bundle-previous").disabled = state.bundles.page <= 1;
        find("admin-store-bundle-next").disabled = pageCount == 0 || state.bundles.page >= pageCount;
    };

    const loadBundles = async () => {
        const request = ++state.bundleRequest;
        const tbody = find("admin-store-bundles");
        tbody.replaceChildren();
        const loadingRow = tbody.insertRow();
        const loadingCell = loadingRow.insertCell();
        loadingCell.colSpan = 4;
        loadingCell.className = "text-center text-body-secondary";
        loadingCell.textContent = loc("general_loading");
        find("admin-store-bundle-previous").disabled = true;
        find("admin-store-bundle-next").disabled = true;

        try {
            const data = await window.adminStorePriceApi.listBundles({
                page: state.bundlePage,
                pageSize: state.bundlePageSize
            });
            if (request != state.bundleRequest) return;
            state.bundles = data;
            state.bundlePage = data.page;
            state.bundlePageSize = data.pageSize;
            renderBundles();
        } catch (error) {
            if (request != state.bundleRequest) return;
            toast(error.responseText || loc("settings_changeFailed"), "danger");
            state.bundles = { items: [], page: 1, pageSize: state.bundlePageSize, pageCount: 0, total: 0 };
            renderBundles();
        }
    };

    const resetBundleForm = () => {
        find("admin-store-bundle-form").reset();
        find("admin-store-bundle-components").replaceChildren();
        addBundleComponent();
    };

    const editStoreBundle = bundle => {
        find("admin-store-bundle-type").value = bundle.TypeName;
        find("admin-store-bundle-components").replaceChildren();
        for (const component of bundle.Components) addBundleComponent(component);
        find("admin-store-bundle-type").scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const saveStoreBundle = async () => {
        const components = [...find("admin-store-bundle-components").children].map(row => {
            const duration = row.querySelector(".admin-store-bundle-component-duration").value;
            return {
                TypeName: row.querySelector(".admin-store-bundle-component-type").value.trim(),
                PurchaseQuantity: Number(row.querySelector(".admin-store-bundle-component-quantity").value),
                ...(duration === "" ? {} : { DurabilityDays: Number(duration) })
            };
        });
        if (
            !components.length ||
            components.some(component => !component.TypeName || !Number.isInteger(component.PurchaseQuantity))
        ) {
            toast(loc("admin_storeBundleRequired"), "danger");
            return;
        }
        try {
            await window.adminStorePriceApi.saveBundle({
                TypeName: find("admin-store-bundle-type").value.trim(),
                Components: components
            });
            resetBundleForm();
            await loadBundles();
            toast(loc("admin_storeBundleSaved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    };

    const deleteStoreBundle = async typeName => {
        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_delete"),
            message: loc("admin_storeBundleDeleteConfirm").replace("|ITEM|", typeName),
            variant: "danger",
            icon: "bi-trash"
        });
        if (!confirmed) return;
        try {
            await window.adminStorePriceApi.deleteBundle(typeName);
            await loadBundles();
            toast(loc("admin_storeBundleDeleted"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    };

    const renderCatalog = () => {
        const tbody = find("admin-store-price-catalog");
        tbody.replaceChildren();
        for (const price of state.data.items) {
            const row = tbody.insertRow();
            const itemCell = row.insertCell();
            itemCell.textContent = itemDisplayLabel(price.TypeName);
            const path = document.createElement("div");
            path.className = "small text-body-secondary text-break font-monospace";
            path.textContent = price.TypeName;
            itemCell.append(path);
            row.insertCell().textContent = price.PremiumPrice ?? "-";
            row.insertCell().textContent = price.RegularPrice ?? "-";
            row.insertCell().textContent =
                price.Source === "supplemental"
                    ? loc("admin_storePriceSourceSupplemental")
                    : loc("admin_storePriceSourcePublicExport");
            row.insertCell().textContent = price.SyncedAt
                ? new Date(price.SyncedAt).toLocaleString()
                : loc("admin_never");
            const actions = row.insertCell();
            if (price.Source === "supplemental") {
                const edit = document.createElement("button");
                edit.className = "btn btn-sm btn-outline-primary me-2";
                edit.textContent = loc("admin_edit");
                edit.onclick = () => editSupplementalPrice(price);
                const remove = document.createElement("button");
                remove.className = "btn btn-sm btn-outline-danger";
                remove.textContent = loc("admin_delete");
                remove.onclick = () => deleteSupplementalPrice(price.TypeName);
                actions.append(edit, remove);
            }
        }

        const pageCount = state.data.pageCount;
        find("admin-store-price-total").textContent = state.data.total.toLocaleString();
        find("admin-store-price-empty").classList.toggle("d-none", state.data.items.length > 0);
        find("admin-store-price-page-status").textContent = loc("admin_storePricePageStatus")
            .replace("|PAGE|", state.data.pageCount ? state.data.page : 0)
            .replace("|PAGES|", pageCount)
            .replace("|TOTAL|", state.data.total.toLocaleString());
        find("admin-store-price-previous").disabled = state.data.page <= 1;
        find("admin-store-price-next").disabled = pageCount == 0 || state.data.page >= pageCount;
    };

    const loadCatalog = async () => {
        const request = ++state.request;
        const tbody = find("admin-store-price-catalog");
        tbody.replaceChildren();
        const loadingRow = tbody.insertRow();
        const loadingCell = loadingRow.insertCell();
        loadingCell.colSpan = 6;
        loadingCell.className = "text-center text-body-secondary";
        loadingCell.textContent = loc("general_loading");
        try {
            const data = await window.adminStorePriceApi.list(state);
            if (request != state.request) return;
            state.data = data;
            state.page = data.page;
            state.pageSize = data.pageSize;
            renderCatalog();
        } catch (error) {
            if (request == state.request) {
                toast(error.responseText || loc("settings_changeFailed"), "danger");
                state.data = { items: [], page: 1, pageSize: state.pageSize, pageCount: 0, total: 0 };
                renderCatalog();
            }
        }
    };

    const resetForm = () => {
        find("admin-supplemental-price-form").reset();
    };

    const editSupplementalPrice = price => {
        find("admin-supplemental-price-type").value = price.TypeName;
        find("admin-supplemental-price-premium").value = price.PremiumPrice ?? "";
        find("admin-supplemental-price-regular").value = price.RegularPrice ?? "";
        find("admin-supplemental-price-type").scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const saveSupplementalPrice = async () => {
        const payload = {
            TypeName: find("admin-supplemental-price-type").value.trim(),
            PremiumPrice: optionalPrice("admin-supplemental-price-premium"),
            RegularPrice: optionalPrice("admin-supplemental-price-regular")
        };
        if (!payload.TypeName || (payload.PremiumPrice === undefined && payload.RegularPrice === undefined)) {
            toast(loc("admin_supplementalPriceRequired"), "danger");
            return;
        }
        try {
            await window.adminStorePriceApi.save(payload);
            resetForm();
            state.page = 1;
            await loadCatalog();
            toast(loc("admin_supplementalPriceSaved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    };

    const deleteSupplementalPrice = async typeName => {
        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_delete"),
            message: loc("admin_supplementalPriceDeleteConfirm").replace("|ITEM|", typeName),
            variant: "danger",
            icon: "bi-trash"
        });
        if (!confirmed) return;
        try {
            await window.adminStorePriceApi.delete(typeName);
            await loadCatalog();
            toast(loc("admin_supplementalPriceDeleted"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    };

    const syncStorePrices = async () => {
        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_syncStorePrices"),
            message: loc("admin_storePriceSyncConfirm"),
            variant: "primary",
            icon: "bi-arrow-repeat"
        });
        if (!confirmed) return;
        const button = find("admin-store-price-sync");
        button.disabled = true;
        try {
            const result = await window.adminStorePriceApi.sync();
            await loadCatalog();
            toast(
                loc("admin_storePriceSyncComplete")
                    .replace("|TOTAL|", result.official.total)
                    .replace("|CREATED|", result.official.created)
                    .replace("|UPDATED|", result.official.updated)
                    .replace("|OVERRIDES|", result.overrides.updated)
                    .replace("|UNRESOLVED|", result.overrides.unresolved.length),
                "success"
            );
        } catch (error) {
            toast(error.responseText || loc("admin_storePriceSyncFailed"), "danger");
        } finally {
            button.disabled = false;
        }
    };

    const changePage = delta => {
        const nextPage = state.page + delta;
        if (nextPage < 1 || (state.data.pageCount && nextPage > state.data.pageCount)) return;
        state.page = nextPage;
        void loadCatalog();
    };

    const changeBundlePage = delta => {
        const nextPage = state.bundlePage + delta;
        if (nextPage < 1 || (state.bundles.pageCount && nextPage > state.bundles.pageCount)) return;
        state.bundlePage = nextPage;
        void loadBundles();
    };

    const bind = (id, event, callback) => find(id)?.addEventListener(event, callback);
    bind("admin-store-bundle-form", "submit", event => {
        event.preventDefault();
        void saveStoreBundle();
    });
    bind("admin-store-bundle-add-component", "click", () => addBundleComponent());
    bind("admin-store-bundle-reset", "click", resetBundleForm);
    bind("admin-supplemental-price-form", "submit", event => {
        event.preventDefault();
        void saveSupplementalPrice();
    });
    bind("admin-supplemental-price-reset", "click", resetForm);
    bind("admin-store-price-sync", "click", () => void syncStorePrices());
    bind("admin-store-price-previous", "click", () => changePage(-1));
    bind("admin-store-price-next", "click", () => changePage(1));
    bind("admin-store-bundle-previous", "click", () => changeBundlePage(-1));
    bind("admin-store-bundle-next", "click", () => changeBundlePage(1));

    find("admin-store-price-search")?.addEventListener("input", event => {
        state.search = event.target.value.trim();
        state.page = 1;
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => void loadCatalog(), 250);
    });
    find("admin-store-price-page-size")?.addEventListener("change", event => {
        state.pageSize = Number(event.target.value);
        state.page = 1;
        void loadCatalog();
    });
    find("admin-store-bundle-page-size")?.addEventListener("change", event => {
        state.bundlePageSize = Number(event.target.value);
        state.bundlePage = 1;
        void loadBundles();
    });

    Object.assign(window, {
        saveAdminSupplementalPrice: saveSupplementalPrice,
        resetAdminSupplementalPriceForm: resetForm,
        addAdminStoreBundleComponent: addBundleComponent,
        saveAdminStoreBundle: saveStoreBundle,
        resetAdminStoreBundleForm: resetBundleForm,
        syncAdminStorePrices: syncStorePrices,
        changeAdminStorePricePage: changePage,
        changeAdminStoreBundlePage: changeBundlePage
    });

    single.getRoute("/webui/store-prices").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) return;
            state.page = 1;
            state.search = "";
            state.bundlePage = 1;
            state.bundlePageSize = 25;
            find("admin-store-price-search").value = "";
            find("admin-store-bundle-page-size").value = state.bundlePageSize;
            resetForm();
            try {
                const [items, dataStatus] = await Promise.all([
                    window.adminItemCatalog.load(window.lang),
                    window.adminDataApi.itemDataStatus()
                ]);
                find("admin-store-catalog-version").textContent = dataStatus.packageVersion;
                find("admin-store-catalog-item-count").textContent = items.length.toLocaleString();
                window.adminDataPage.setupItemPicker("admin-store-bundle-type");
                window.adminDataPage.setupItemPicker(
                    "admin-supplemental-price-type",
                    "admin-supplemental-price-type-resolved"
                );
                resetBundleForm();
                await Promise.all([loadCatalog(), loadBundles()]);
            } catch (error) {
                toast(error.responseText || loc("settings_changeFailed"), "danger");
            }
        });
    });
})();
