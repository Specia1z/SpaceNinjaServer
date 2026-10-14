(() => {
    let storeOverrides = { items: [], page: 1, pageSize: 25, pageCount: 0, total: 0 };
    let storeOverrideRequest = 0;
    let storeOverrideSearch = "";
    let storeOverrideSearchTimer;

    const formatDate = value => (value ? new Date(value).toLocaleString() : loc("admin_noLimit"));
    const optionalNumber = id => {
        const value = document.getElementById(id).value;
        return value === "" ? undefined : Number(value);
    };
    const optionalInteger = id => {
        const value = optionalNumber(id);
        return value === undefined ? undefined : Math.trunc(value);
    };
    const optionalBoolean = id => {
        const value = document.getElementById(id).value;
        return value === "" ? undefined : value === "true";
    };
    const optionalDate = id => {
        const value = document.getElementById(id).value;
        return value ? new Date(value).toISOString() : undefined;
    };
    const formatDateTimeLocal = value => {
        if (!value) return "";
        const date = new Date(value);
        const pad = number => String(number).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
            date.getMinutes()
        )}`;
    };

    function itemDisplayLabel(uniqueName) {
        return window.adminItemCatalog?.getLabel(uniqueName) ?? uniqueName ?? "";
    }

    function appendSummaryLines(cell, values) {
        cell.className = "admin-store-override-summary";
        values.forEach((value, index) => {
            const line = document.createElement("div");
            if (index > 0) line.className = "small text-body-secondary";
            line.textContent = value;
            cell.append(line);
        });
    }

    function setupItemPicker(inputId, resolvedId) {
        window.adminItemCatalog?.setupPicker(inputId, resolvedId);
    }

    async function loadItemDataStatus() {
        const status = await window.adminDataApi.itemDataStatus();
        const catalogVersion = document.getElementById("admin-addable-items-version");
        const catalogCount = document.getElementById("admin-addable-items-count");
        if (catalogVersion) catalogVersion.textContent = status.packageVersion;
        if (catalogCount) catalogCount.textContent = window.adminItemCatalog.items.length.toLocaleString();
        const select = document.getElementById("admin-game-version");
        const selected = localStorage.getItem("adminGameVersion") ?? "latest";
        select.replaceChildren();
        const latest = document.createElement("option");
        latest.value = "latest";
        latest.textContent = loc("admin_latestVersion");
        select.append(latest);
        status.gameVersions.forEach(version => {
            const option = document.createElement("option");
            option.value = version;
            option.textContent = version;
            select.append(option);
        });
        select.value = [...select.options].some(option => option.value == selected) ? selected : "latest";
        const counts = status.counts;
        const count = (fileName, legacyName) => counts[fileName] ?? counts[legacyName] ?? 0;
        const statusText = loc("admin_itemDataStatus")
            .replace("|SOURCE|", status.source)
            .replace("|VERSION|", status.packageVersion)
            .replace("|SYNCED_AT|", status.syncedAt ? new Date(status.syncedAt).toLocaleString() : loc("admin_never"))
            .replace("|FILES|", status.fileCount ?? 0)
            .replace("|ENTRIES|", (status.totalEntries ?? 0).toLocaleString())
            .replace("|WARFRAMES|", count("ExportWarframes", "warframes"))
            .replace("|WEAPONS|", count("ExportWeapons", "weapons"))
            .replace("|MODS|", count("ExportUpgrades", "upgrades"))
            .replace("|SENTINELS|", count("ExportSentinels", "sentinels"))
            .replace("|RESOURCES|", count("ExportResources", "resources"))
            .replace("|RECIPES|", count("ExportRecipes", "recipes"))
            .replace("|RELICS|", count("ExportRelics", "relics"));
        const statusElement = document.getElementById("admin-item-data-status");
        const segments = statusText.split(" · ");
        const metadata = document.createElement("div");
        metadata.className = "admin-data-meta";
        segments.slice(0, 4).forEach(segment => {
            const item = document.createElement("span");
            item.className = "admin-data-meta-item";
            item.textContent = segment;
            metadata.append(item);
        });

        const metrics = document.createElement("div");
        metrics.className = "admin-data-metrics";
        segments.slice(4).forEach((segment, index) => {
            const separator = segment.includes("：") ? "：" : ": ";
            const separatorIndex = segment.indexOf(separator);
            const metric = document.createElement("div");
            metric.className = `admin-data-metric${index === 0 ? " admin-data-metric-total" : ""}`;
            const label = document.createElement("span");
            label.className = "admin-data-metric-label";
            const value = document.createElement("strong");
            value.className = "admin-data-metric-value";
            if (separatorIndex < 0) {
                label.textContent = segment;
            } else {
                label.textContent = segment.slice(0, separatorIndex);
                value.textContent = segment.slice(separatorIndex + separator.length);
            }
            metric.append(label);
            if (value.textContent) metric.append(value);
            metrics.append(metric);
        });
        statusElement.className = "admin-data-status";
        statusElement.replaceChildren(metadata, metrics);
        document.getElementById("admin-item-sync").disabled = status.running;
    }

    async function syncItemData() {
        const button = document.getElementById("admin-item-sync");
        button.disabled = true;
        try {
            await window.adminDataApi.syncItemData();
            fetchItemList();
            await Promise.all([window.itemListPromise, window.adminItemCatalog.load(window.lang, true)]);
            await loadItemDataStatus();
            toast(loc("admin_syncComplete"), "success");
        } catch (error) {
            toast(error.responseText || loc("admin_syncFailed"), "danger");
        } finally {
            button.disabled = false;
        }
    }

    function setGameVersion() {
        localStorage.setItem("adminGameVersion", document.getElementById("admin-game-version").value);
        fetchItemList();
        window.itemListPromise.then(() => toast(loc("admin_filterApplied"), "success"));
    }

    function resetStoreForm() {
        document.getElementById("admin-store-form").reset();
        document.getElementById("admin-store-enabled").checked = true;
        document.getElementById("admin-store-listed").checked = true;
        document.getElementById("admin-store-purchasable").checked = true;
        document.getElementById("admin-store-giftable").value = "";
        document.getElementById("admin-store-gifting-bonus").value = "";
        document.getElementById("admin-store-purchase-mode").value = "";
        document.getElementById("admin-store-category").value = "";
        document.getElementById("admin-store-supporter").value = "";
        document.getElementById("admin-store-featured").value = "";
        document.getElementById("admin-store-popular").value = "";
        document.getElementById("admin-store-bogo-buy").value = "";
        document.getElementById("admin-store-bogo-get").value = "";
        document.getElementById("admin-store-banner-index").value = "";
        document.getElementById("admin-store-category-start").value = "";
        document.getElementById("admin-store-category-end").value = "";
        document.getElementById("admin-store-product-expiry").value = "";
    }

    function editStoreOverride(index) {
        const override = storeOverrides.items[index];
        document.getElementById("admin-store-type").value = override.TypeName;
        document.getElementById("admin-store-type").dispatchEvent(new Event("input"));
        document.getElementById("admin-store-enabled").checked = override.Enabled;
        document.getElementById("admin-store-listed").checked = override.Listed;
        document.getElementById("admin-store-purchasable").checked = override.Purchasable ?? override.Listed;
        document.getElementById("admin-store-giftable").value =
            override.Giftable === undefined ? "" : String(override.Giftable);
        document.getElementById("admin-store-gifting-bonus").value = override.GiftingBonus ?? "";
        document.getElementById("admin-store-purchase-mode").value = override.PurchaseMode ?? "";
        document.getElementById("admin-store-category").value = override.CategoryName ?? "";
        document.getElementById("admin-store-supporter").value =
            override.SupporterPack === undefined ? "" : String(override.SupporterPack);
        document.getElementById("admin-store-featured").value =
            override.Featured === undefined ? "" : String(override.Featured);
        document.getElementById("admin-store-popular").value =
            override.Popular === undefined ? "" : String(override.Popular);
        document.getElementById("admin-store-bogo-buy").value = override.BogoBuy ?? "";
        document.getElementById("admin-store-bogo-get").value = override.BogoGet ?? "";
        document.getElementById("admin-store-banner-index").value = override.BannerIndex ?? "";
        document.getElementById("admin-store-category-start").value = formatDateTimeLocal(override.CategoryStartDate);
        document.getElementById("admin-store-category-end").value = formatDateTimeLocal(override.CategoryEndDate);
        document.getElementById("admin-store-discount").value = override.DiscountPercent ?? "";
        document.getElementById("admin-store-premium").value = override.PremiumPrice ?? "";
        document.getElementById("admin-store-regular").value = override.RegularPrice ?? "";
        document.getElementById("admin-store-start").value = formatDateTimeLocal(override.StartDate);
        document.getElementById("admin-store-end").value = formatDateTimeLocal(override.EndDate);
        document.getElementById("admin-store-product-expiry").value = formatDateTimeLocal(override.ProductExpiryDate);
        document.getElementById("admin-store-type").scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function renderStoreOverrides() {
        const tbody = document.getElementById("admin-store-overrides");
        tbody.replaceChildren();
        storeOverrides.items.forEach((override, index) => {
            const row = tbody.insertRow();
            const itemCell = row.insertCell();
            itemCell.className = "admin-store-override-item";
            itemCell.textContent = itemDisplayLabel(override.TypeName);
            const path = document.createElement("div");
            path.className = "small text-body-secondary text-break font-monospace";
            path.textContent = override.TypeName;
            itemCell.append(path);
            appendSummaryLines(row.insertCell(), [
                `${override.Enabled ? loc("admin_enabled") : loc("admin_disabled")} / ${override.Listed ? loc("admin_listed") : loc("admin_unlisted")}`,
                `${(override.Purchasable ?? override.Listed) ? loc("admin_purchasable") : loc("admin_notPurchasable")} / ${
                    override.Giftable === undefined
                        ? loc("admin_storeGameDefault")
                        : loc(override.Giftable ? "admin_storeGiftAllowed" : "admin_storeGiftDenied")
                }`,
                `${loc(
                    override.PurchaseMode === "platinum"
                        ? "admin_storePlatinum"
                        : override.PurchaseMode === "steam"
                          ? "admin_storeSteam"
                          : "admin_storeGameDefault"
                )} / ${override.CategoryName || loc("admin_storeCategoryAuto")}`
            ]);
            appendSummaryLines(row.insertCell(), [
                loc("admin_pricingSummary")
                    .replace(
                        "|DISCOUNT|",
                        override.DiscountPercent === undefined ? "-" : `${override.DiscountPercent}%`
                    )
                    .replace("|PREMIUM|", override.PremiumPrice ?? "-")
                    .replace("|REGULAR|", override.RegularPrice ?? "-")
            ]);
            appendSummaryLines(row.insertCell(), [
                `${loc("admin_storePromotionSchedule")}: ${formatDate(override.StartDate)} - ${formatDate(override.EndDate)}`,
                `${loc("admin_storeProductExpirySchedule")}: ${formatDate(override.ProductExpiryDate)}`,
                `${loc("admin_storeCategorySchedule")}: ${formatDate(override.CategoryStartDate)} - ${formatDate(override.CategoryEndDate)}`
            ]);
            const actions = row.insertCell();
            actions.className = "text-nowrap admin-store-override-actions";
            const edit = document.createElement("button");
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.textContent = loc("admin_edit");
            edit.onclick = () => editStoreOverride(index);
            const remove = document.createElement("button");
            remove.className = "btn btn-sm btn-outline-danger";
            remove.textContent = loc("admin_delete");
            remove.onclick = () => deleteStoreOverride(override.TypeName);
            actions.append(edit, remove);
        });

        document.getElementById("admin-store-override-page-status").textContent = loc("admin_storeOverridePageStatus")
            .replace("|PAGE|", storeOverrides.pageCount ? storeOverrides.page : 0)
            .replace("|PAGES|", storeOverrides.pageCount)
            .replace("|TOTAL|", storeOverrides.total.toLocaleString());
        document.getElementById("admin-store-override-previous").disabled = storeOverrides.page <= 1;
        document.getElementById("admin-store-override-next").disabled =
            storeOverrides.pageCount == 0 || storeOverrides.page >= storeOverrides.pageCount;
    }

    async function loadStoreOverrides() {
        const request = ++storeOverrideRequest;
        const tbody = document.getElementById("admin-store-overrides");
        tbody.replaceChildren();
        const loadingRow = tbody.insertRow();
        const loadingCell = loadingRow.insertCell();
        loadingCell.colSpan = 5;
        loadingCell.className = "text-center text-body-secondary";
        loadingCell.textContent = loc("general_loading");
        document.getElementById("admin-store-override-previous").disabled = true;
        document.getElementById("admin-store-override-next").disabled = true;
        try {
            const data = await window.adminDataApi.listStoreOverrides({
                page: storeOverrides.page,
                pageSize: storeOverrides.pageSize,
                search: storeOverrideSearch
            });
            if (request != storeOverrideRequest) return;
            storeOverrides = data;
            renderStoreOverrides();
        } catch (error) {
            if (request != storeOverrideRequest) return;
            toast(error.responseText || loc("settings_changeFailed"), "danger");
            storeOverrides = { items: [], page: 1, pageSize: storeOverrides.pageSize, pageCount: 0, total: 0 };
            renderStoreOverrides();
        }
    }

    function changeStoreOverridePage(delta) {
        const nextPage = storeOverrides.page + delta;
        if (nextPage < 1 || (storeOverrides.pageCount && nextPage > storeOverrides.pageCount)) return;
        storeOverrides.page = nextPage;
        void loadStoreOverrides();
    }

    async function saveStoreOverride() {
        const listed = document.getElementById("admin-store-listed").checked;
        const payload = {
            TypeName: document.getElementById("admin-store-type").value.trim(),
            Enabled: document.getElementById("admin-store-enabled").checked,
            Listed: listed,
            Purchasable: listed && document.getElementById("admin-store-purchasable").checked,
            Giftable:
                document.getElementById("admin-store-giftable").value === ""
                    ? undefined
                    : document.getElementById("admin-store-giftable").value === "true",
            GiftingBonus: document.getElementById("admin-store-gifting-bonus").value.trim() || undefined,
            PurchaseMode: document.getElementById("admin-store-purchase-mode").value || undefined,
            CategoryName: document.getElementById("admin-store-category").value || undefined,
            DiscountPercent: optionalNumber("admin-store-discount"),
            PremiumPrice: optionalNumber("admin-store-premium"),
            RegularPrice: optionalNumber("admin-store-regular"),
            SupporterPack: optionalBoolean("admin-store-supporter"),
            Featured: optionalBoolean("admin-store-featured"),
            Popular: optionalBoolean("admin-store-popular"),
            BogoBuy: optionalInteger("admin-store-bogo-buy"),
            BogoGet: optionalInteger("admin-store-bogo-get"),
            BannerIndex: optionalInteger("admin-store-banner-index"),
            CategoryStartDate: optionalDate("admin-store-category-start"),
            CategoryEndDate: optionalDate("admin-store-category-end"),
            ProductExpiryDate: optionalDate("admin-store-product-expiry"),
            StartDate: optionalDate("admin-store-start"),
            EndDate: optionalDate("admin-store-end")
        };
        try {
            await window.adminDataApi.saveStoreOverride(payload);
            resetStoreForm();
            storeOverrides.page = 1;
            await loadStoreOverrides();
            toast(loc("admin_overrideSaved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    async function deleteStoreOverride(typeName) {
        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_delete"),
            message: loc("admin_deleteOverrideConfirm").replace("|ITEM|", typeName),
            variant: "danger",
            icon: "bi-trash"
        });
        if (!confirmed) return;
        try {
            await window.adminDataApi.deleteStoreOverride(typeName);
            await loadStoreOverrides();
            toast(loc("admin_storeOverrideDeleted"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    document.getElementById("admin-store-override-search")?.addEventListener("input", event => {
        storeOverrideSearch = event.target.value.trim();
        storeOverrides.page = 1;
        clearTimeout(storeOverrideSearchTimer);
        storeOverrideSearchTimer = setTimeout(() => void loadStoreOverrides(), 250);
    });

    document.getElementById("admin-store-override-page-size")?.addEventListener("change", event => {
        storeOverrides.pageSize = Number(event.target.value);
        storeOverrides.page = 1;
        void loadStoreOverrides();
    });

    function updateCraftingFormState() {
        const speed = document.getElementById("admin-crafting-speed").value;
        const seconds = document.getElementById("admin-crafting-seconds");
        seconds.disabled = speed != "custom";
        if (speed != "custom") seconds.value = "";
        const rush = document.getElementById("admin-crafting-rush-cost").value;
        const platinum = document.getElementById("admin-crafting-rush-platinum");
        platinum.disabled = rush != "custom";
        if (rush != "custom") platinum.value = "";
    }

    function resetCraftingConfig() {
        document.getElementById("admin-crafting-speed").value = "default";
        document.getElementById("admin-crafting-seconds").value = "";
        document.getElementById("admin-crafting-multiplier").value = 1;
        document.getElementById("admin-crafting-rush-cost").value = "stock";
        document.getElementById("admin-crafting-rush-platinum").value = "";
        document.getElementById("admin-crafting-keep-blueprints").checked = false;
        updateCraftingFormState();
    }

    async function loadCraftingConfig() {
        const data = await window.adminDataApi.getCraftingConfig();
        const serverWide = (data.configs ?? []).find(config => config.Key == "server");
        if (serverWide) {
            document.getElementById("admin-crafting-speed").value = serverWide.SpeedMode;
            document.getElementById("admin-crafting-seconds").value = serverWide.BuildTimeSeconds ?? 0;
            document.getElementById("admin-crafting-multiplier").value = serverWide.CostMultiplier ?? 1;
            document.getElementById("admin-crafting-rush-cost").value = serverWide.RushCostMode ?? "stock";
            document.getElementById("admin-crafting-rush-platinum").value = serverWide.RushCostPlatinum ?? 0;
            document.getElementById("admin-crafting-keep-blueprints").checked = !!serverWide.KeepBlueprints;
        } else resetCraftingConfig();
        updateCraftingFormState();
        const effective = data.effective;
        const parts = [];
        if (effective.buildTime === undefined) parts.push(loc("admin_effectiveStockTime"));
        else if (effective.buildTime === 0) parts.push(loc("admin_effectiveInstant"));
        else parts.push(loc("admin_effectiveSeconds").replace("|SECONDS|", effective.buildTime));
        parts.push(loc("admin_effectiveCost").replace("|MULT|", effective.buildPriceMultiplier));
        if (effective.skipBuildTimePrice === undefined) parts.push(loc("admin_effectiveRushStock"));
        else if (effective.skipBuildTimePrice === 0) parts.push(loc("admin_effectiveRushFree"));
        else parts.push(loc("admin_effectiveRush").replace("|PLATINUM|", effective.skipBuildTimePrice));
        parts.push(
            effective.consumeOnUse === false
                ? loc("admin_effectiveKeepBlueprints")
                : loc("admin_effectiveConsumeBlueprints")
        );
        const element = document.getElementById("admin-crafting-effective");
        element.textContent = loc("admin_effectiveSummary").replace(
            "|DETAILS|",
            parts.join(loc("admin_effectiveSeparator"))
        );
        element.classList.remove("d-none");
    }

    async function saveCraftingConfig() {
        const speed = document.getElementById("admin-crafting-speed").value;
        const rushCost = document.getElementById("admin-crafting-rush-cost").value;
        const payload = {
            SpeedMode: speed,
            BuildTimeSeconds: speed == "custom" ? Number(document.getElementById("admin-crafting-seconds").value) : 0,
            CostMultiplier: Number(document.getElementById("admin-crafting-multiplier").value),
            RushCostMode: rushCost,
            RushCostPlatinum:
                rushCost == "custom" ? Number(document.getElementById("admin-crafting-rush-platinum").value) : 0,
            KeepBlueprints: document.getElementById("admin-crafting-keep-blueprints").checked
        };
        try {
            await window.adminDataApi.saveCraftingConfig(payload);
            await loadCraftingConfig();
            toast(loc("admin_craftingSaved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    const bind = (id, event, callback) => document.getElementById(id)?.addEventListener(event, callback);
    bind("admin-item-sync", "click", () => void syncItemData());
    bind("admin-item-status-refresh", "click", () => void loadItemDataStatus());
    bind("admin-game-version", "change", setGameVersion);
    bind("admin-crafting-form", "submit", event => {
        event.preventDefault();
        void saveCraftingConfig();
    });
    bind("admin-crafting-speed", "change", updateCraftingFormState);
    bind("admin-crafting-rush-cost", "change", updateCraftingFormState);
    bind("admin-crafting-reset", "click", resetCraftingConfig);
    bind("admin-store-form", "submit", event => {
        event.preventDefault();
        void saveStoreOverride();
    });
    bind("admin-store-reset", "click", resetStoreForm);
    bind("admin-store-override-previous", "click", () => changeStoreOverridePage(-1));
    bind("admin-store-override-next", "click", () => changeStoreOverridePage(1));

    const exports = {
        formatDate,
        optionalDate,
        itemDisplayLabel,
        setupItemPicker,
        loadItemDataStatus,
        syncItemData,
        setGameVersion,
        resetStoreForm,
        saveStoreOverride,
        changeStoreOverridePage,
        updateCraftingFormState,
        resetCraftingConfig,
        saveCraftingConfig
    };
    window.adminDataPage = exports;
    Object.assign(window, {
        loadAdminItemDataStatus: loadItemDataStatus,
        syncAdminItemData: syncItemData,
        setAdminGameVersion: setGameVersion,
        resetAdminStoreForm: resetStoreForm,
        saveAdminStoreOverride: saveStoreOverride,
        changeAdminStoreOverridePage: changeStoreOverridePage,
        updateAdminCraftingFormState: updateCraftingFormState,
        resetAdminCraftingConfig: resetCraftingConfig,
        saveAdminCraftingConfig: saveCraftingConfig
    });

    single.getRoute("/webui/admin-data").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) return;
            try {
                storeOverrides.page = 1;
                storeOverrides.pageSize = 25;
                storeOverrideSearch = "";
                document.getElementById("admin-store-override-search").value = "";
                document.getElementById("admin-store-override-page-size").value = storeOverrides.pageSize;
                const [catalog] = await Promise.all([
                    window.adminItemCatalog.load(window.lang),
                    loadItemDataStatus(),
                    loadStoreOverrides(),
                    loadCraftingConfig()
                ]);
                document.getElementById("admin-addable-items-count").textContent = catalog.length.toLocaleString();
                setupItemPicker("admin-store-type", "admin-store-type-resolved");
            } catch (error) {
                toast(error.responseText || loc("settings_changeFailed"), "danger");
            }
        });
    });
})();
