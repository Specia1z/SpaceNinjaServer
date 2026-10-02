(() => {
    const state = {
        page: 1,
        pageSize: 50,
        search: "",
        request: 0,
        searchTimer: undefined,
        data: { items: [], page: 1, pageSize: 50, pageCount: 0, total: 0 }
    };

    const find = id => document.getElementById(id);

    const itemDisplayLabel = typeName => {
        const entry = (window.itemSearchIndex ?? []).find(item => item.uniqueName === typeName);
        return entry?.name ? `${entry.name} (${typeName})` : typeName;
    };

    const optionalPrice = id => {
        const value = find(id).value;
        return value === "" ? undefined : Number(value);
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
        find("admin-store-price-page-status").textContent = loc("admin_storePricePageStatus")
            .replace("|PAGE|", state.data.pageCount ? state.data.page : 0)
            .replace("|PAGES|", pageCount)
            .replace("|TOTAL|", state.data.total.toLocaleString());
        find("admin-store-price-previous").disabled = state.data.page <= 1;
        find("admin-store-price-next").disabled = pageCount == 0 || state.data.page >= pageCount;
    };

    const loadCatalog = async () => {
        const request = ++state.request;
        try {
            const data = await window.adminStorePriceApi.list(state);
            if (request != state.request) return;
            state.data = data;
            state.page = data.page;
            state.pageSize = data.pageSize;
            renderCatalog();
        } catch (error) {
            if (request == state.request) toast(error.responseText || loc("settings_changeFailed"), "danger");
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
        if (!confirm(loc("admin_supplementalPriceDeleteConfirm").replace("|ITEM|", typeName))) return;
        try {
            await window.adminStorePriceApi.delete(typeName);
            await loadCatalog();
            toast(loc("admin_supplementalPriceDeleted"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    };

    const syncStorePrices = async () => {
        if (!confirm(loc("admin_storePriceSyncConfirm"))) return;
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

    Object.assign(window, {
        saveAdminSupplementalPrice: saveSupplementalPrice,
        resetAdminSupplementalPriceForm: resetForm,
        syncAdminStorePrices: syncStorePrices,
        changeAdminStorePricePage: changePage
    });

    single.getRoute("/webui/store-prices").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) return;
            state.page = 1;
            state.search = "";
            find("admin-store-price-search").value = "";
            resetForm();
            await loadCatalog();
            window.itemListPromise?.then(() => {
                window.adminDataPage?.setupItemPicker(
                    "admin-supplemental-price-type",
                    "admin-supplemental-price-type-resolved"
                );
            });
        });
    });
})();
