(() => {
    const root = document.getElementById("drop-table-route");
    if (!root) return;

    const state = {
        page: 1,
        pageSize: 25,
        search: "",
        request: 0,
        data: { items: [], page: 1, pageSize: 25, pageCount: 0, total: 0 },
        poolId: 0,
        itemId: 0
    };

    const find = id => document.getElementById(id);
    const showAccessDenied = () => {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.remove("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.add("d-none"));
    };

    const showAdminContent = () => {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.add("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.remove("d-none"));
    };

    const createInput = (className, value, type = "text") => {
        const input = document.createElement("input");
        input.className = className;
        input.type = type;
        input.value = value ?? "";
        return input;
    };

    const addPoolItem = (container, item = {}) => {
        const row = document.createElement("div");
        row.className = "row g-2 mb-2 align-items-start admin-drop-item-row";

        const typeColumn = document.createElement("div");
        typeColumn.className = "col-lg-8 admin-drop-item-type-column";
        const typeInput = createInput("form-control font-monospace admin-drop-item-type", item.type);
        typeInput.required = true;
        typeInput.placeholder = loc("admin_dropItemPlaceholder");
        typeInput.id = `admin-drop-item-${++state.itemId}`;
        typeColumn.append(typeInput);

        const probabilityColumn = document.createElement("div");
        probabilityColumn.className = "col-lg-3";
        const probabilityInput = createInput("form-control admin-drop-item-probability", item.probability ?? 1, "number");
        probabilityInput.min = "0";
        probabilityInput.max = "1000000000";
        probabilityInput.step = "0.0001";
        probabilityInput.required = true;
        probabilityInput.title = loc("admin_dropProbability");
        probabilityColumn.append(probabilityInput);

        const actionColumn = document.createElement("div");
        actionColumn.className = "col-lg-1 text-end";
        const remove = document.createElement("button");
        remove.className = "btn btn-sm btn-outline-danger";
        remove.type = "button";
        remove.title = loc("admin_dropRemoveItem");
        remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        remove.onclick = () => row.remove();
        actionColumn.append(remove);

        row.append(typeColumn, probabilityColumn, actionColumn);
        container.append(row);
        window.adminItemCatalog?.setupPicker(typeInput.id);
    };

    const addPool = (pool = {}) => {
        const container = find("admin-drop-pools");
        const section = document.createElement("section");
        section.className = "admin-drop-pool";
        section.dataset.poolId = String(++state.poolId);

        const header = document.createElement("div");
        header.className = "admin-drop-pool-header";
        const title = document.createElement("h3");
        title.className = "h6 mb-0";
        title.textContent = loc("admin_dropPool");
        const remove = document.createElement("button");
        remove.className = "btn btn-sm btn-outline-danger";
        remove.type = "button";
        remove.title = loc("admin_dropRemovePool");
        remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        remove.onclick = () => section.remove();
        header.append(title, remove);

        const controls = document.createElement("div");
        controls.className = "row g-2 mb-3";
        const typeColumn = document.createElement("div");
        typeColumn.className = "col-md-6";
        const typeLabel = document.createElement("label");
        typeLabel.className = "form-label";
        typeLabel.textContent = loc("admin_dropPoolType");
        const typeSelect = document.createElement("select");
        typeSelect.className = "form-select admin-drop-pool-type";
        ["mod", "blueprint", "resource", "sigil", "additionalItem", "relic"].forEach(type => {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = type;
            option.selected = type == (pool.type ?? "resource");
            typeSelect.append(option);
        });
        typeColumn.append(typeLabel, typeSelect);

        const chanceColumn = document.createElement("div");
        chanceColumn.className = "col-md-6";
        const chanceLabel = document.createElement("label");
        chanceLabel.className = "form-label";
        chanceLabel.textContent = loc("admin_dropChance");
        const chanceInput = createInput("form-control admin-drop-pool-chance", pool.chance ?? 1, "number");
        chanceInput.min = "0";
        chanceInput.max = "1";
        chanceInput.step = "0.0001";
        chanceInput.required = true;
        chanceColumn.append(chanceLabel, chanceInput);
        controls.append(typeColumn, chanceColumn);

        const itemHeading = document.createElement("div");
        itemHeading.className = "admin-drop-items-heading";
        const itemLabel = document.createElement("span");
        itemLabel.className = "form-label mb-0";
        itemLabel.textContent = loc("admin_dropItems");
        const addItem = document.createElement("button");
        addItem.className = "btn btn-sm btn-outline-secondary";
        addItem.type = "button";
        addItem.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i>' + loc("admin_dropAddItem");
        addItem.onclick = () => addPoolItem(itemContainer);
        itemHeading.append(itemLabel, addItem);

        const itemContainer = document.createElement("div");
        itemContainer.className = "admin-drop-items";
        for (const item of pool.items ?? []) addPoolItem(itemContainer, item);

        section.append(header, controls, itemHeading, itemContainer);
        container.append(section);
    };

    const resetForm = () => {
        find("admin-drop-table-form").reset();
        find("admin-drop-table-enabled").checked = true;
        find("admin-drop-pools").replaceChildren();
        state.poolId = 0;
        state.itemId = 0;
    };

    const readPools = () =>
        [...find("admin-drop-pools").children].map(section => ({
            type: section.querySelector(".admin-drop-pool-type").value,
            chance: Number(section.querySelector(".admin-drop-pool-chance").value),
            items: [...section.querySelector(".admin-drop-items").children].map(row => ({
                type: row.querySelector(".admin-drop-item-type").value.trim(),
                probability: Number(row.querySelector(".admin-drop-item-probability").value)
            }))
        }));

    const renderDetailMeta = detail => {
        const enemies = find("admin-drop-enemies");
        enemies.replaceChildren();
        if (!detail.Enemies.length) {
            enemies.textContent = loc("admin_dropNoEnemyReferences");
            return;
        }
        detail.Enemies.slice(0, 24).forEach(enemy => {
            const item = document.createElement("div");
            item.className = "admin-drop-enemy";
            const name = document.createElement("strong");
            name.textContent = enemy.name;
            const path = document.createElement("span");
            path.className = "font-monospace small text-body-secondary";
            path.textContent = enemy.uniqueName;
            item.append(name, path);
            if (enemy.isBoss) {
                const badge = document.createElement("span");
                badge.className = "badge text-bg-warning ms-2";
                badge.textContent = loc("admin_dropBoss");
                item.append(badge);
            }
            enemies.append(item);
        });
        if (detail.Enemies.length > 24) {
            const more = document.createElement("span");
            more.className = "small text-body-secondary";
            more.textContent = loc("admin_dropMoreEnemies").replace("|COUNT|", detail.Enemies.length - 24);
            enemies.append(more);
        }
    };

    const loadDetail = async dropTable => {
        try {
            const detail = await window.adminDropTableApi.detail(dropTable);
            find("admin-drop-table-path").value = detail.DropTable;
            find("admin-drop-table-enabled").checked = detail.Override?.Enabled ?? true;
            find("admin-drop-pools").replaceChildren();
            state.poolId = 0;
            state.itemId = 0;
            for (const pool of detail.Override?.Pools ?? detail.DefaultPools) addPool(pool);
            renderDetailMeta(detail);
            find("admin-drop-table-path").scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (error) {
            toast(error.responseText || loc("admin_dropLoadFailed"), "danger");
        }
    };

    const renderList = () => {
        const tbody = find("admin-drop-table-list");
        tbody.replaceChildren();
        for (const item of state.data.items) {
            const row = tbody.insertRow();
            const tableCell = row.insertCell();
            tableCell.className = "font-monospace small text-break";
            tableCell.textContent = item.DropTable;
            const enemyCell = row.insertCell();
            enemyCell.className = "admin-drop-enemy-list";
            enemyCell.textContent = item.Enemies.length
                ? item.Enemies.slice(0, 3).map(enemy => enemy.name).join(", ")
                : loc("admin_dropCustomTable");
            if (item.Enemies.length > 3) enemyCell.textContent += ` +${item.Enemies.length - 3}`;
            const poolCell = row.insertCell();
            poolCell.textContent = String(item.PoolCount);
            const stateCell = row.insertCell();
            stateCell.innerHTML = item.HasOverride
                ? `<span class="badge ${item.Enabled ? "text-bg-success" : "text-bg-secondary"}">${loc(
                      item.Enabled ? "admin_enabled" : "admin_disabled"
                  )}</span>`
                : `<span class="badge text-bg-light">${loc("admin_dropStock")}</span>`;
            const actions = row.insertCell();
            const edit = document.createElement("button");
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.title = loc("admin_edit");
            edit.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
            edit.onclick = () => void loadDetail(item.DropTable);
            actions.append(edit);
            if (item.HasOverride) {
                const remove = document.createElement("button");
                remove.className = "btn btn-sm btn-outline-danger";
                remove.title = loc("admin_delete");
                remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
                remove.onclick = () => void deleteOverride(item.DropTable);
                actions.append(remove);
            }
        }
        find("admin-drop-table-empty").classList.toggle("d-none", state.data.items.length > 0);
        find("admin-drop-table-page-status").textContent = loc("admin_dropPageStatus")
            .replace("|PAGE|", state.data.pageCount ? state.data.page : 0)
            .replace("|PAGES|", state.data.pageCount)
            .replace("|TOTAL|", state.data.total.toLocaleString());
        find("admin-drop-table-previous").disabled = state.data.page <= 1;
        find("admin-drop-table-next").disabled = state.data.pageCount == 0 || state.data.page >= state.data.pageCount;
    };

    const loadList = async () => {
        const request = ++state.request;
        try {
            const data = await window.adminDropTableApi.list(state);
            if (request != state.request) return;
            state.data = data;
            state.page = data.page;
            state.pageSize = data.pageSize;
            renderList();
        } catch (error) {
            if (request != state.request) return;
            toast(error.responseText || loc("admin_dropLoadFailed"), "danger");
        }
    };

    const saveOverride = async () => {
        const payload = {
            DropTable: find("admin-drop-table-path").value.trim(),
            Enabled: find("admin-drop-table-enabled").checked,
            Pools: readPools()
        };
        if (!payload.DropTable || payload.Pools.some(pool => !Number.isFinite(pool.chance) || pool.chance < 0 || pool.chance > 1 || pool.items.some(item => !item.type || !Number.isFinite(item.probability) || item.probability < 0))) {
            toast(loc("admin_dropInvalid"), "danger");
            return;
        }
        try {
            await window.adminDropTableApi.save(payload);
            await loadList();
            toast(loc("admin_dropSaved"), "success");
        } catch (error) {
            toast(error.responseText || loc("admin_dropSaveFailed"), "danger");
        }
    };

    const deleteOverride = async dropTable => {
        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_delete"),
            message: loc("admin_dropDeleteConfirm").replace("|ITEM|", dropTable),
            variant: "danger",
            icon: "bi-trash"
        });
        if (!confirmed) return;
        try {
            await window.adminDropTableApi.delete(dropTable);
            await loadList();
            if (find("admin-drop-table-path").value == dropTable) await loadDetail(dropTable);
            toast(loc("admin_dropDeleted"), "success");
        } catch (error) {
            toast(error.responseText || loc("admin_dropSaveFailed"), "danger");
        }
    };

    const changePage = offset => {
        state.page = Math.max(1, state.page + offset);
        void loadList();
    };

    const bind = (id, event, handler) => find(id)?.addEventListener(event, handler);
    bind("admin-drop-table-form", "submit", event => {
        event.preventDefault();
        void saveOverride();
    });
    bind("admin-drop-add-pool", "click", () => addPool({ type: "resource", chance: 1, items: [] }));
    bind("admin-drop-reset", "click", resetForm);
    bind("admin-drop-table-previous", "click", () => changePage(-1));
    bind("admin-drop-table-next", "click", () => changePage(1));
    bind("admin-drop-table-page-size", "change", event => {
        state.pageSize = Number(event.target.value);
        state.page = 1;
        void loadList();
    });
    find("admin-drop-table-search")?.addEventListener("input", event => {
        state.search = event.target.value.trim();
        state.page = 1;
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => void loadList(), 250);
    });

    Object.assign(window, {
        addAdminDropPool: () => addPool({ type: "resource", chance: 1, items: [] }),
        saveAdminDropTable: saveOverride,
        resetAdminDropTable: resetForm
    });

    single.getRoute("/webui/drop-tables").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            if (!applyServerConfig(await getServerConfig())) {
                showAccessDenied();
                return;
            }
            showAdminContent();
            state.page = 1;
            state.search = "";
            find("admin-drop-table-search").value = "";
            find("admin-drop-table-page-size").value = String(state.pageSize);
            resetForm();
            try {
                await window.adminItemCatalog.load(window.lang);
                await loadList();
            } catch (error) {
                showAccessDenied();
                toast(error.responseText || loc("admin_dropLoadFailed"), "danger");
            }
        });
    });
})();
