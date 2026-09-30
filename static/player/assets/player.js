(() => {
    const $ = selector => document.querySelector(selector);
    const state = { account: null, market: null, marketAdmin: null };
    const authView = $("#auth-view");
    const dashboardView = $("#dashboard-view");
    let renameCountdownTimer = null;

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

    function formData(form) {
        return Object.fromEntries(new FormData(form).entries());
    }

    function showNotice(element, message, good = false) {
        element.textContent = message;
        element.style.color = good ? "var(--accent)" : "var(--danger)";
    }

    function errorText(error) {
        const texts = {
            invalid_login: "邮箱或密码不正确。",
            email_taken: "这个邮箱已经注册过了。",
            invalid_registration: "请检查邮箱和密码，密码至少 8 位。",
            registration_rate_limited: "注册请求太多了，休息一下再试。",
            registration_disabled: "现在还不能创建新账号。",
            invalid_name: "昵称需要是 1 到 24 个正常字符。",
            taken: "这个昵称已经被别人用了。",
            cooldown: "你刚改过昵称，再等一等就可以了。",
            funds: "白金不够，还不能换这个昵称。",
            disabled: "这个功能现在还没开放。",
            wrong_password: "当前密码不正确。",
            invalid_password: "新密码至少需要 8 位。",
            admin_required: "只有管理员可以调整这里。",
            invalid_policy: "有一项设置不符合要求。",
            account_already_exists: "这个账号已经存在了。",
            invalid_player: "请输入玩家的注册邮箱。",
            player_not_found: "没有找到这个玩家。",
            referral_not_flagged: "这个玩家没有待审核的邀请风险。",
            market_account_too_new: "账号创建满 24 小时后才能使用资源市场。",
            market_account_limit: "已达到账号今日市场额度。",
            market_global_limit: "已达到全服今日市场额度。",
            market_insufficient_funds: "白金不够。",
            market_inventory_changed: "仓库数量刚刚发生变化，请刷新后重试。",
            market_stock_changed: "系统库存刚刚发生变化，请刷新后重试。",
            invalid_market_policy: "市场设置不符合允许范围。"
        };
        return texts[error.message] || error.message || "操作失败，请稍后再试。";
    }

    function setButtonBusy(button, busy, busyText = "处理中...") {
        if (!button) return;
        if (busy) {
            button.dataset.defaultText = button.textContent;
            button.textContent = busyText;
            button.disabled = true;
        } else {
            button.textContent = button.dataset.defaultText || button.textContent;
            button.disabled = false;
        }
    }

    function setAuthTab(tab) {
        document
            .querySelectorAll("[data-auth-tab]")
            .forEach(button => button.classList.toggle("active", button.dataset.authTab === tab));
        $("#login-form").classList.toggle("hidden", tab !== "login");
        $("#register-form").classList.toggle("hidden", tab !== "register");
        $("#auth-notice").textContent = "";
    }

    function formatCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const days = Math.floor(totalSeconds / 86_400);
        const hours = Math.floor((totalSeconds % 86_400) / 3_600);
        const minutes = Math.floor((totalSeconds % 3_600) / 60);
        const seconds = totalSeconds % 60;
        return days > 0
            ? `${days} 天 ${String(hours).padStart(2, "0")} 小时`
            : `${String(hours).padStart(2, "0")} 时 ${String(minutes).padStart(2, "0")} 分 ${String(seconds).padStart(2, "0")} 秒`;
    }

    function renderRenameStatus(account) {
        if (renameCountdownTimer) {
            clearInterval(renameCountdownTimer);
            renameCountdownTimer = null;
        }
        const hint = $("#rename-hint");
        const controls = $("#rename-controls");
        const renameButton = controls.querySelector("button");
        const rename = account.rename;
        const setRenameButtonText = text => {
            renameButton.textContent = text;
            renameButton.dataset.defaultText = text;
        };
        if (!account.policy.renameEnabled) {
            controls.classList.add("hidden");
            renameButton.disabled = true;
            hint.textContent = "换昵称功能现在还没开放。";
            return;
        }
        if (rename?.status === "first" && rename.firstRenameAvailable) {
            controls.classList.remove("hidden");
            renameButton.disabled = false;
            setRenameButtonText("免费更换昵称");
            const cooldownText = account.policy.renameCooldownDays
                ? `，每次改名后需要等待 ${account.policy.renameCooldownDays} 天`
                : "";
            hint.textContent = `您还有 1 次免费改名机会。首次改名不需要白金，之后每次改名需要 ${account.policy.renameCost} 白金${cooldownText}。`;
            return;
        }
        if (rename?.status === "cooldown" && rename.cooldownUntil) {
            controls.classList.add("hidden");
            renameButton.disabled = true;
            const cooldownUntil = new Date(rename.cooldownUntil).getTime();
            const updateCountdown = () => {
                const remaining = cooldownUntil - Date.now();
                if (remaining <= 0) {
                    clearInterval(renameCountdownTimer);
                    renameCountdownTimer = null;
                    controls.classList.remove("hidden");
                    renameButton.disabled = false;
                    setRenameButtonText(
                        account.policy.renameCost > 0 ? `花 ${account.policy.renameCost} 白金换昵称` : "免费更换昵称"
                    );
                    hint.textContent = "冷却结束了，现在可以再次改名。";
                    return;
                }
                hint.textContent = `改名冷却中，还需 ${formatCountdown(remaining)}。`;
            };
            updateCountdown();
            renameCountdownTimer = setInterval(updateCountdown, 1000);
            return;
        }
        controls.classList.remove("hidden");
        renameButton.disabled = false;
        setRenameButtonText(
            account.policy.renameCost > 0 ? `花 ${account.policy.renameCost} 白金换昵称` : "免费更换昵称"
        );
        hint.textContent = `每次改名需要 ${account.policy.renameCost} 白金。`;
    }

    function render(account) {
        state.account = account;
        authView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        $("#session-tools").classList.remove("hidden");
        $("#header-name").textContent = account.displayName;
        $("#welcome-name").textContent = account.displayName;
        $("#welcome-email").textContent = account.email;
        $("#platinum-value").textContent = account.platinum.toLocaleString();
        $("#free-platinum-value").textContent = account.freePlatinum.toLocaleString();
        $("#referral-count").textContent = account.referralCount;
        $("#referral-limit").textContent =
            `已邀请 ${account.referralCount} 位朋友，最多 ${account.policy.maxReferralsPerAccount} 位`;

        const maxReferrals = account.policy.maxReferralsPerAccount;
        const progress = maxReferrals > 0 ? Math.min(100, (account.referralCount / maxReferrals) * 100) : 0;
        $("#invite-progress-label").textContent = `${account.referralCount} / ${maxReferrals}`;
        $("#invite-progress-bar").style.width = `${progress}%`;

        $("#referral-code").textContent = account.referralCode || "暂未开放";
        $("#inviter-reward").textContent = `${account.policy.inviterReward} 白金`;
        $("#invitee-reward").textContent = `${account.policy.inviteeReward} 白金`;
        $("#milestone-reward").textContent = account.policy.milestoneEvery
            ? `${account.policy.milestoneBonus} / ${account.policy.milestoneEvery} 人`
            : "未开启";
        const qualification = account.referralQualification;
        $("#referral-qualification").classList.toggle("hidden", !qualification);
        if (qualification) {
            const remainingSeconds = Math.max(0, qualification.requiredOnlineSeconds - qualification.onlineSeconds);
            $("#referral-qualification-text").textContent = qualification.risk
                ? "暂不发放，请联系管理员核实邀请关系"
                : qualification.qualified
                  ? "已达成，奖励已发放"
                  : `还需在游戏中在线 ${Math.ceil(remainingSeconds / 60)} 分钟`;
        }
        renderRenameStatus(account);
        $("#copy-code").disabled = !account.referralCode;
        $(".referral-panel").classList.toggle("hidden", !account.policy.referralsEnabled);
        $("#admin-panel").classList.toggle("hidden", !account.isAdmin);
        if (account.isAdmin) {
            loadAdminPolicy();
            loadAdminMarketPolicy();
        }
    }

    async function refresh() {
        try {
            render(await api("/me"));
        } catch {
            authView.classList.remove("hidden");
            dashboardView.classList.add("hidden");
            $("#session-tools").classList.add("hidden");
        }
    }

    async function loadAdminPolicy() {
        try {
            const policy = await api("/admin/policy");
            const form = $("#policy-form");
            Object.entries(policy).forEach(([key, value]) => {
                const input = form.elements[key];
                if (input) input.type === "checkbox" ? (input.checked = value) : (input.value = value);
            });
        } catch (error) {
            showNotice($("#admin-notice"), errorText(error));
        }
    }

    async function loadAdminMarketPolicy() {
        try {
            state.marketAdmin = await api("/admin/market");
            const form = $("#market-policy-form");
            Object.entries(state.marketAdmin).forEach(([key, value]) => {
                const input = form.elements[key];
                if (!input) return;
                if (input.type === "checkbox") input.checked = value;
                else if (key === "excludedItemPatterns") input.value = Array.isArray(value) ? value.join("\n") : "";
                else if (typeof value !== "object") input.value = value;
            });
        } catch (error) {
            showNotice($("#market-admin-notice"), errorText(error));
        }
    }

    $("#login-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button[type=submit]");
        setButtonBusy(button, true, "正在进入...");
        try {
            render(await api("/login", { method: "POST", body: JSON.stringify(formData(event.target)) }));
        } catch (error) {
            showNotice($("#auth-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    $("#register-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button[type=submit]");
        setButtonBusy(button, true, "正在创建...");
        try {
            render(await api("/register", { method: "POST", body: JSON.stringify(formData(event.target)) }));
        } catch (error) {
            showNotice($("#auth-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    $("#rename-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button[type=submit]");
        setButtonBusy(button, true, "正在更换...");
        try {
            render(await api("/rename", { method: "POST", body: JSON.stringify(formData(event.target)) }));
            showNotice($("#settings-notice"), "昵称换好了。", true);
            event.target.reset();
        } catch (error) {
            showNotice($("#settings-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    $("#password-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button[type=submit]");
        setButtonBusy(button, true, "正在更新...");
        try {
            await api("/password", { method: "POST", body: JSON.stringify(formData(event.target)) });
            showNotice($("#settings-notice"), "密码换好了，请重新登录。", true);
            await api("/logout", { method: "POST" });
            setTimeout(() => location.reload(), 700);
        } catch (error) {
            showNotice($("#settings-notice"), errorText(error));
            setButtonBusy(button, false);
        }
    });

    $("#copy-code").addEventListener("click", async event => {
        if (!state.account?.referralCode) return;
        const button = event.currentTarget;
        try {
            await navigator.clipboard.writeText(state.account.referralCode);
            showNotice($("#invite-notice"), "邀请码已复制，发给朋友就好。", true);
            setButtonBusy(button, true, "已复制");
            setTimeout(() => setButtonBusy(button, false), 1400);
        } catch {
            showNotice($("#invite-notice"), "复制失败，请手动选中邀请码。");
        }
    });

    $("#logout-button").addEventListener("click", async event => {
        setButtonBusy(event.currentTarget, true, "正在退出...");
        await api("/logout", { method: "POST" });
        location.reload();
    });

    $("#policy-form").addEventListener("submit", async event => {
        event.preventDefault();
        const values = formData(event.target);
        ["enabled", "registrationEnabled", "renameEnabled", "firstRenameEnabled", "referralsEnabled"].forEach(
            key => (values[key] = event.target.elements[key].checked)
        );
        [
            "renameCost",
            "renameCooldownDays",
            "inviterReward",
            "inviteeReward",
            "maxReferralsPerAccount",
            "referralRequiredOnlineMinutes",
            "milestoneEvery",
            "milestoneBonus"
        ].forEach(key => (values[key] = Number(values[key])));
        const button = event.target.querySelector("button[type=submit]");
        setButtonBusy(button, true, "正在保存...");
        try {
            await api("/admin/policy", { method: "POST", body: JSON.stringify(values) });
            showNotice($("#admin-notice"), "设置已保存。", true);
            await refresh();
        } catch (error) {
            showNotice($("#admin-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    $("#reset-rename-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button[type=submit]");
        const email = event.target.elements.email.value.trim().toLowerCase();
        setButtonBusy(button, true, "正在重置...");
        try {
            const result = await api("/admin/reset-rename-cooldown", {
                method: "POST",
                body: JSON.stringify(formData(event.target))
            });
            showNotice($("#reset-rename-notice"), `${result.displayName} 的改名冷却已重置。`, true);
            event.target.reset();
            if (state.account?.email?.toLowerCase() === email) await refresh();
        } catch (error) {
            showNotice($("#reset-rename-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    $("#approve-referral-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button[type=submit]");
        const email = event.target.elements.email.value.trim().toLowerCase();
        setButtonBusy(button, true, "正在审核...");
        try {
            const result = await api("/admin/approve-referral", {
                method: "POST",
                body: JSON.stringify(formData(event.target))
            });
            showNotice($("#approve-referral-notice"), `${result.displayName} 的邀请已通过审核。`, true);
            event.target.reset();
            if (state.account?.email?.toLowerCase() === email) await refresh();
        } catch (error) {
            showNotice($("#approve-referral-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    $("#market-policy-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.target;
        const values = formData(form);
        ["enabled", "buyEnabled", "sellEnabled"].forEach(key => (values[key] = form.elements[key].checked));
        [
            "accountDailyPlatinumCap",
            "accountDailyTransactionLimit",
            "accountDailyQuantityCap",
            "globalDailyMintCap",
            "globalDailyTransactionLimit",
            "globalDailyQuantityCap",
            "priceSpreadPercent",
            "priceChangeLimitPercent",
            "minimumAccountAgeHours"
        ].forEach(key => (values[key] = Number(values[key])));
        values.excludedItemPatterns = values.excludedItemPatterns
            .split("\n")
            .map(value => value.trim())
            .filter(Boolean);
        values.itemOverrides = state.marketAdmin?.itemOverrides || {};
        const button = form.querySelector("button[type=submit]");
        setButtonBusy(button, true, "正在保存...");
        try {
            state.marketAdmin = await api("/admin/market", { method: "POST", body: JSON.stringify(values) });
            showNotice($("#market-admin-notice"), "市场设置已保存。", true);
        } catch (error) {
            showNotice($("#market-admin-notice"), errorText(error));
        } finally {
            setButtonBusy(button, false);
        }
    });

    document
        .querySelectorAll("[data-auth-tab]")
        .forEach(button => button.addEventListener("click", () => setAuthTab(button.dataset.authTab)));

    refresh();
})();
