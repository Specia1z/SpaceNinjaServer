(() => {
    const $ = selector => document.querySelector(selector);
    const state = { account: null, market: null, category: "all" };
    const categoryLabels = {
        all: "全部物资",
        resources: "资源材料",
        components: "制造组件",
        mods: "Mod",
        warframes: "战甲",
        primary: "主武器",
        secondary: "副武器",
        melee: "近战武器",
        sentinel: "守护武器",
        archwing: "Archwing 武器",
        cosmetics: "外观",
        other: "其他物资"
    };

    async function api(path, options = {}) {
        const response = await fetch(`/player/api${path}`, {
            ...options,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            credentials: "same-origin"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "操作失败");
        return data;
    }

    function escapeHtml(value) {
        return String(value).replace(
            /[&<>'"]/g,
            character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]
        );
    }

    function imageMarkup(icon) {
        const source = icon?.startsWith("http") || icon?.startsWith("/PublicExport/") ? icon : `/PublicExport${icon}`;
        return icon
            ? `<img class="market-image" src="${source}" alt=""><span class="market-icon-fallback" hidden>ITEM</span>`
            : '<span class="market-icon-fallback">ITEM</span>';
    }

    function priceChangeMarkup(item) {
        const change = Number(item.priceChangePercent || 0);
        if (change === 0) return '<span class="market-price-change flat">0.00% 持平</span>';
        const direction = item.priceChangeDirection === "down" ? "down" : "up";
        const label = direction === "down" ? "跌幅" : "涨幅";
        return `<span class="market-price-change ${direction}">${change > 0 ? "+" : ""}${change.toFixed(2)}% ${label}</span>`;
    }

    function formatPrice(value) {
        return Math.round(Number(value)).toLocaleString("zh-CN");
    }

    function requestId() {
        return `${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    }

    function categoryFor(item) {
        if (item.category) return item.category;
        const itemType = item.itemType;
        if (itemType.includes("/Resources/")) return "resources";
        if (itemType.includes("/Components/")) return "components";
        return "other";
    }

    function errorText(error) {
        return (
            {
                market_account_too_new: "账号创建满 24 小时后才能使用资源市场。",
                market_account_limit: "已达到账号今日市场额度。",
                market_global_limit: "已达到全服今日交易额度。",
                market_insufficient_funds: "白金不够。",
                market_inventory_changed: "仓库数量刚刚发生变化，请刷新后重试。",
                market_listing_changed: "系统库存刚刚发生变化，请刷新后重试。",
                market_listing_unavailable: "系统库存已不足，请刷新后重试。",
                market_system_inventory_unavailable: "系统库存暂时不可用，请稍后重试。",
                market_request_in_progress: "这笔交易正在处理中，请稍后刷新。",
                market_seller_unavailable: "卖家仓库暂时不可用，这笔交易没有完成。"
            }[error.message] ||
            error.message ||
            "操作失败，请稍后再试。"
        );
    }

    function notice(message, good = false) {
        const element = $("#market-notice");
        element.textContent = message;
        element.classList.toggle("good", good);
    }

    function renderSellInventory() {
        $("#market-sell-inventory").innerHTML = state.market.inventory.length
            ? state.market.inventory
                  .map(
                      item =>
                           `<div class="market-inventory-row" data-item-type="${escapeHtml(item.itemType)}" data-inventory-field="${escapeHtml(item.inventoryField)}" data-mode="${escapeHtml(item.mode)}" data-owned="${item.owned}"><div class="market-inventory-name"><div class="market-row-icon">${imageMarkup(item.icon)}</div><div><strong>${escapeHtml(item.displayName)}</strong></div></div><strong>${item.owned.toLocaleString()}</strong><input data-sell-quantity type="number" min="1" max="${item.owned}" value="1"><button class="button button-secondary" data-market-action="sell" type="button">卖给系统</button></div>`
                  )
                  .join("")
            : '<div class="market-inventory-empty">当前仓库没有可出售物资。只有真实库存中的普通物资会出现在这里。</div>';
    }

    function renderCategories() {
        const counts = Object.fromEntries(Object.keys(categoryLabels).map(key => [key, 0]));
        state.market.items.forEach(item => {
            counts[categoryFor(item)] += 1;
            counts.all += 1;
        });
        $("#market-categories").innerHTML = Object.entries(categoryLabels)
            .filter(([key]) => key === "all" || counts[key])
            .map(
                ([key, label]) =>
                    `<button class="market-category ${state.category === key ? "active" : ""}" data-category="${key}" type="button"><span>${label}</span><strong>${counts[key]}</strong></button>`
            )
            .join("");
    }

    function renderListings() {
        const market = state.market;
        const query = $("#market-search").value.trim().toLowerCase();
        const filtered = market.items.filter(item => {
            const categoryMatch = state.category === "all" || categoryFor(item) === state.category;
            const queryMatch =
                !query ||
                item.displayName.toLowerCase().includes(query) ||
                item.itemType.toLowerCase().includes(query);
            return categoryMatch && queryMatch;
        });
        const visible = filtered.slice(0, 300);
        $("#market-result-label").textContent = categoryLabels[state.category];
        $("#market-result-count").textContent =
            `${filtered.length.toLocaleString()} 类物资${filtered.length > visible.length ? " · 当前显示前 300 类" : ""}`;
        $("#market-usage").textContent =
            `今日交易 ${market.usage.accountTransactions.toLocaleString()} / ${market.policy.accountDailyTransactionLimit.toLocaleString()} 次 · 系统库存 ${market.items.length.toLocaleString()} 类`;
        $("#market-listings").innerHTML = visible.length
            ? visible
                   .map(item => {
                       return `<article class="market-row" data-item-type="${escapeHtml(item.itemType)}" data-inventory-field="${escapeHtml(item.inventoryField)}" data-mode="${escapeHtml(item.mode)}">
                       <div class="market-row-icon">${imageMarkup(item.icon)}</div>
                       <div class="market-row-name"><strong>${escapeHtml(item.displayName)}</strong><small>系统库存</small></div>
                       <div class="market-row-stock"><span>系统库存</span><strong>${item.systemStock.toLocaleString()}</strong><small>个物资</small></div>
                       <div class="market-row-quote"><span class="buy-quote">${formatPrice(item.buyUnitPrice)} 白金 / 个</span>${priceChangeMarkup(item)}</div>
                       <div class="market-row-actions"><input data-market-quantity type="number" min="1" max="${item.systemStock}" value="1"><button class="button button-primary" data-market-action="buy" type="button">购买</button></div>
                   </article>`;
                  })
                  .join("")
             : '<div class="market-empty"><strong>暂时没有商品展示</strong><span>系统库存中还没有这类物资。</span></div>';
    }

    function render() {
        if (!state.market?.enabled) {
            $("#market-listings").classList.add("hidden");
            $("#market-disabled").classList.remove("hidden");
            return;
        }
        $("#market-listings").classList.remove("hidden");
        $("#market-disabled").classList.add("hidden");
        renderSellInventory();
        renderCategories();
        renderListings();
    }

    async function loadMarket() {
        try {
            state.market = await api("/market");
            render();
        } catch (error) {
            if (error.message === "login_required") location.href = "/player/login";
            else notice(errorText(error));
        }
    }

    async function submitSell(row, button) {
        const values = {
            itemType: row.dataset.itemType,
            inventoryField: row.dataset.inventoryField,
            mode: row.dataset.mode,
            quantity: Number(row.querySelector("[data-sell-quantity]").value),
            requestId: requestId()
        };
        button.disabled = true;
        try {
            await api("/market/sell", { method: "POST", body: JSON.stringify(values) });
            notice("物资已卖给系统，白金已入账。", true);
            await loadMarket();
        } catch (error) {
            notice(errorText(error));
        } finally {
            button.disabled = false;
        }
    }

    async function trade(row, side, quantity, button) {
        button.disabled = true;
        try {
            const result = await api(`/market/${side}`, {
                method: "POST",
                body: JSON.stringify({ inventoryField: row.dataset.inventoryField, itemType: row.dataset.itemType, mode: row.dataset.mode, quantity, requestId: requestId() })
            });
            state.account.platinum = result.platinum;
            $("#market-platinum").textContent = result.platinum.toLocaleString();
            notice("物资已加入你的仓库。", true);
            await loadMarket();
        } catch (error) {
            notice(errorText(error));
            await loadMarket();
        } finally {
            button.disabled = false;
        }
    }

    $("#market-search").addEventListener("input", renderListings);
    document.addEventListener(
        "error",
        event => {
            const image = event.target;
            if (!image.matches?.(".market-image")) return;
            image.hidden = true;
            image.nextElementSibling?.removeAttribute("hidden");
        },
        true
    );
    $("#market-sell-inventory").addEventListener("click", event => {
        const button = event.target.closest("[data-market-action=sell]");
        if (!button) return;
        submitSell(button.closest("[data-item-type]"), button);
    });
    $("#market-categories").addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        state.category = button.dataset.category;
        renderCategories();
        renderListings();
    });
    $("#market-listings").addEventListener("click", event => {
        const button = event.target.closest("[data-market-action]");
        if (!button) return;
        const row = button.closest("[data-item-type]");
        const quantity = Number(row.querySelector("[data-market-quantity]").value);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) return notice("请输入有效的物资数量。");
        trade(row, button.dataset.marketAction, quantity, button);
    });
    $("#market-logout").addEventListener("click", async event => {
        event.currentTarget.disabled = true;
        await api("/logout");
        location.href = "/player/login";
    });

    api("/me")
        .then(account => {
            state.account = account;
            $("#market-player-name").textContent = account.displayName;
            $("#market-platinum").textContent = account.platinum.toLocaleString();
            loadMarket();
        })
        .catch(error => {
            if (error.message === "login_required") location.href = "/player/login";
            else notice(errorText(error));
        });
})();
