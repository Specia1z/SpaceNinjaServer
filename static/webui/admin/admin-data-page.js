(() => {
    const currencyLabels = {
        RegularCredits: "currency_RegularCredits",
        PremiumCredits: "currency_PremiumCredits",
        PremiumCreditsFree: "currency_PremiumCreditsFree",
        FusionPoints: "currency_FusionPoints",
        CrewShipFusionPoints: "currency_CrewShipFusionPoints",
        PrimeTokens: "currency_PrimeTokens"
    };
    let storeOverrides = [];

    const formatDate = value => (value ? new Date(value).toLocaleString() : loc("admin_noLimit"));
    const optionalNumber = id => {
        const value = document.getElementById(id).value;
        return value === "" ? undefined : Number(value);
    };
    const optionalDate = id => {
        const value = document.getElementById(id).value;
        return value ? new Date(value).toISOString() : undefined;
    };

    function itemDisplayLabel(uniqueName) {
        if (!uniqueName) return "";
        if (currencyLabels[uniqueName]) return loc(currencyLabels[uniqueName]);
        const entry = (window.itemSearchIndex ?? []).find(item => item.uniqueName === uniqueName);
        return entry?.name ? `${entry.name} (${uniqueName})` : uniqueName;
    }

    function setupItemPicker(inputId, resolvedId) {
        const input = document.getElementById(inputId);
        if (!input || input.dataset.pickerReady) return;
        input.dataset.pickerReady = "true";
        const resolved = resolvedId ? document.getElementById(resolvedId) : null;
        const list = document.createElement("div");
        list.className = "list-group position-absolute w-100 shadow-sm d-none";
        list.style.zIndex = "1050";
        list.style.maxHeight = "18rem";
        list.style.overflowY = "auto";
        input.parentElement.classList.add("position-relative");
        input.parentElement.append(list);

        const updateResolved = () => {
            if (!resolved) return;
            const uniqueName = input.value.trim();
            resolved.textContent = !uniqueName
                ? ""
                : currencyLabels[uniqueName]
                  ? loc(currencyLabels[uniqueName])
                  : (window.itemSearchIndex ?? []).find(item => item.uniqueName === uniqueName)?.name ||
                    loc("admin_itemUnknownName");
        };
        const hideList = () => {
            list.classList.add("d-none");
            list.replaceChildren();
        };
        const renderMatches = () => {
            const query = input.value.trim().toLowerCase();
            if (!query) return hideList();
            const matches = (window.itemSearchIndex ?? [])
                .filter(item => item.searchName.includes(query) || item.uniqueName.toLowerCase().includes(query))
                .sort((a, b) => {
                    const rank = item =>
                        item.uniqueName.toLowerCase() === query ? 0 : item.searchName.startsWith(query) ? 1 : 2;
                    return rank(a) - rank(b) || a.name.localeCompare(b.name);
                })
                .slice(0, 50);
            if (!matches.length) return hideList();
            list.replaceChildren();
            for (const item of matches) {
                const option = document.createElement("button");
                option.type = "button";
                option.className = "list-group-item list-group-item-action py-1";
                const name = document.createElement("div");
                name.textContent = item.name;
                const path = document.createElement("div");
                path.className = "small text-body-secondary text-break font-monospace";
                path.textContent = item.uniqueName;
                option.append(name, path);
                option.onmousedown = event => {
                    event.preventDefault();
                    input.value = item.uniqueName;
                    updateResolved();
                    hideList();
                };
                list.append(option);
            }
            list.classList.remove("d-none");
        };
        input.addEventListener("input", () => {
            renderMatches();
            updateResolved();
        });
        input.addEventListener("focus", renderMatches);
        input.addEventListener("blur", () => setTimeout(hideList, 150));
        updateResolved();
    }

    async function loadItemDataStatus() {
        const status = await window.adminDataApi.itemDataStatus();
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
        document.getElementById("admin-item-data-status").textContent = loc("admin_itemDataStatus")
            .replace("|SOURCE|", status.source)
            .replace("|SYNCED_AT|", status.syncedAt ? new Date(status.syncedAt).toLocaleString() : loc("admin_never"))
            .replace("|WARFRAMES|", counts.warframes ?? 0)
            .replace("|WEAPONS|", counts.weapons ?? 0)
            .replace("|MODS|", counts.upgrades ?? 0)
            .replace("|SENTINELS|", counts.sentinels ?? 0);
        document.getElementById("admin-item-sync").disabled = status.running;
    }

    async function syncItemData() {
        const button = document.getElementById("admin-item-sync");
        button.disabled = true;
        try {
            await window.adminDataApi.syncItemData();
            fetchItemList();
            await window.itemListPromise;
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
    }

    function editStoreOverride(index) {
        const override = storeOverrides[index];
        document.getElementById("admin-store-type").value = override.TypeName;
        document.getElementById("admin-store-type").dispatchEvent(new Event("input"));
        document.getElementById("admin-store-enabled").checked = override.Enabled;
        document.getElementById("admin-store-listed").checked = override.Listed;
        document.getElementById("admin-store-discount").value = override.DiscountPercent ?? "";
        document.getElementById("admin-store-premium").value = override.PremiumPrice ?? "";
        document.getElementById("admin-store-regular").value = override.RegularPrice ?? "";
        document.getElementById("admin-store-start").value = override.StartDate
            ? new Date(override.StartDate).toISOString().slice(0, 16)
            : "";
        document.getElementById("admin-store-end").value = override.EndDate
            ? new Date(override.EndDate).toISOString().slice(0, 16)
            : "";
        document.getElementById("admin-store-type").scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function renderStoreOverrides() {
        const tbody = document.getElementById("admin-store-overrides");
        tbody.replaceChildren();
        storeOverrides.forEach((override, index) => {
            const row = tbody.insertRow();
            const itemCell = row.insertCell();
            itemCell.textContent = itemDisplayLabel(override.TypeName);
            const path = document.createElement("div");
            path.className = "small text-body-secondary text-break font-monospace";
            path.textContent = override.TypeName;
            itemCell.append(path);
            row.insertCell().textContent = [
                override.Enabled ? loc("admin_enabled") : loc("admin_disabled"),
                override.Listed ? loc("admin_listed") : loc("admin_unlisted")
            ].join(" / ");
            row.insertCell().textContent = loc("admin_pricingSummary")
                .replace("|DISCOUNT|", override.DiscountPercent ?? 0)
                .replace("|PREMIUM|", override.PremiumPrice ?? "-")
                .replace("|REGULAR|", override.RegularPrice ?? "-");
            row.insertCell().textContent = `${formatDate(override.StartDate)} - ${formatDate(override.EndDate)}`;
            const actions = row.insertCell();
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
    }

    async function loadStoreOverrides() {
        storeOverrides = await window.adminDataApi.listStoreOverrides();
        renderStoreOverrides();
    }

    async function saveStoreOverride() {
        const payload = {
            TypeName: document.getElementById("admin-store-type").value.trim(),
            Enabled: document.getElementById("admin-store-enabled").checked,
            Listed: document.getElementById("admin-store-listed").checked,
            DiscountPercent: optionalNumber("admin-store-discount"),
            PremiumPrice: optionalNumber("admin-store-premium"),
            RegularPrice: optionalNumber("admin-store-regular"),
            StartDate: optionalDate("admin-store-start"),
            EndDate: optionalDate("admin-store-end")
        };
        try {
            await window.adminDataApi.saveStoreOverride(payload);
            resetStoreForm();
            await loadStoreOverrides();
            toast(loc("admin_overrideSaved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        }
    }

    async function deleteStoreOverride(typeName) {
        if (!confirm(loc("admin_deleteOverrideConfirm").replace("|ITEM|", typeName))) return;
        await window.adminDataApi.deleteStoreOverride(typeName);
        await loadStoreOverrides();
    }

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
        updateAdminCraftingFormState: updateCraftingFormState,
        resetAdminCraftingConfig: resetCraftingConfig,
        saveAdminCraftingConfig: saveCraftingConfig
    });

    single.getRoute("/webui/admin-data").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) return;
            try {
                await Promise.all([loadItemDataStatus(), loadStoreOverrides(), loadCraftingConfig()]);
                window.itemListPromise.then(() => setupItemPicker("admin-store-type", "admin-store-type-resolved"));
            } catch (error) {
                toast(error.responseText || loc("settings_changeFailed"), "danger");
            }
        });
    });
})();
