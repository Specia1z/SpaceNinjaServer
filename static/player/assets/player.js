(() => {
    const $ = selector => document.querySelector(selector);
    const state = { account: null };
    const authView = $("#auth-view");
    const dashboardView = $("#dashboard-view");

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
            email_taken: "邮箱已注册。",
            invalid_registration: "请检查邮箱和密码，密码至少 8 位。",
            registration_rate_limited: "注册请求过于频繁，请稍后再试。",
            invalid_name: "昵称格式不正确。",
            taken: "这个昵称已经被占用。",
            cooldown: "改名冷却中，请稍后再试。",
            funds: "白金余额不足。",
            disabled: "该功能暂未开放。",
            wrong_password: "当前密码不正确。",
            invalid_password: "新密码至少需要 8 位。",
            admin_required: "需要管理员权限。",
            invalid_policy: "策略参数不合法。",
            account_already_exists: "账号已存在。"
        };
        return texts[error.message] || error.message || "操作失败。";
    }

    function setAuthTab(tab) {
        document
            .querySelectorAll("[data-auth-tab]")
            .forEach(button => button.classList.toggle("active", button.dataset.authTab === tab));
        $("#login-form").classList.toggle("hidden", tab !== "login");
        $("#register-form").classList.toggle("hidden", tab !== "register");
        $("#auth-notice").textContent = "";
    }

    function render(account) {
        state.account = account;
        authView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        $("#session-tools").classList.remove("hidden");
        $("#header-name").textContent = account.displayName;
        $("#welcome-name").textContent = account.displayName;
        $("#platinum-value").textContent = account.platinum.toLocaleString();
        $("#free-platinum-value").textContent = account.freePlatinum.toLocaleString();
        $("#referral-count").textContent = account.referralCount;
        $("#referral-limit").textContent = `上限 ${account.policy.maxReferralsPerAccount}`;
        $("#referral-code").textContent = account.referralCode;
        $("#inviter-reward").textContent = `${account.policy.inviterReward} 白金`;
        $("#invitee-reward").textContent = `${account.policy.inviteeReward} 白金`;
        $("#milestone-reward").textContent = account.policy.milestoneEvery
            ? `${account.policy.milestoneBonus} / ${account.policy.milestoneEvery} 人`
            : "未启用";
        $("#rename-hint").textContent = account.policy.renameEnabled
            ? `每次改名消耗 ${account.policy.renameCost} 白金，冷却 ${account.policy.renameCooldownDays} 天。`
            : "改名功能暂未开放。";
        $("#rename-form").querySelector("button").disabled = !account.policy.renameEnabled;
        $("#admin-panel").classList.toggle("hidden", !account.isAdmin);
        $(".referral-panel").classList.toggle("hidden", !account.policy.referralsEnabled);
        if (account.isAdmin) loadAdminPolicy();
    }

    async function refresh() {
        try {
            render(await api("/me"));
        } catch {
            authView.classList.remove("hidden");
            dashboardView.classList.add("hidden");
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

    $("#login-form").addEventListener("submit", async event => {
        event.preventDefault();
        try {
            render(await api("/login", { method: "POST", body: JSON.stringify(formData(event.target)) }));
        } catch (error) {
            showNotice($("#auth-notice"), errorText(error));
        }
    });
    $("#register-form").addEventListener("submit", async event => {
        event.preventDefault();
        try {
            render(await api("/register", { method: "POST", body: JSON.stringify(formData(event.target)) }));
        } catch (error) {
            showNotice($("#auth-notice"), errorText(error));
        }
    });
    $("#rename-form").addEventListener("submit", async event => {
        event.preventDefault();
        try {
            render(await api("/rename", { method: "POST", body: JSON.stringify(formData(event.target)) }));
            showNotice($("#settings-notice"), "昵称已更新。", true);
            event.target.reset();
        } catch (error) {
            showNotice($("#settings-notice"), errorText(error));
        }
    });
    $("#password-form").addEventListener("submit", async event => {
        event.preventDefault();
        try {
            await api("/password", { method: "POST", body: JSON.stringify(formData(event.target)) });
            showNotice($("#settings-notice"), "密码已更新，请重新登录。", true);
            await api("/logout", { method: "POST" });
            setTimeout(() => location.reload(), 700);
        } catch (error) {
            showNotice($("#settings-notice"), errorText(error));
        }
    });
    $("#copy-code").addEventListener("click", async () => {
        await navigator.clipboard.writeText(state.account.referralCode);
        showNotice($("#copy-code"), "已复制", true);
        setTimeout(() => ($("#copy-code").textContent = "复制邀请码"), 1400);
    });
    $("#logout-button").addEventListener("click", async () => {
        await api("/logout", { method: "POST" });
        location.reload();
    });
    $("#policy-form").addEventListener("submit", async event => {
        event.preventDefault();
        const values = formData(event.target);
        ["enabled", "registrationEnabled", "renameEnabled", "referralsEnabled"].forEach(
            key => (values[key] = event.target.elements[key].checked)
        );
        [
            "renameCost",
            "renameCooldownDays",
            "inviterReward",
            "inviteeReward",
            "maxReferralsPerAccount",
            "milestoneEvery",
            "milestoneBonus"
        ].forEach(key => (values[key] = Number(values[key])));
        try {
            await api("/admin/policy", { method: "POST", body: JSON.stringify(values) });
            showNotice($("#admin-notice"), "策略已保存。", true);
            await refresh();
        } catch (error) {
            showNotice($("#admin-notice"), errorText(error));
        }
    });
    document
        .querySelectorAll("[data-auth-tab]")
        .forEach(button => button.addEventListener("click", () => setAuthTab(button.dataset.authTab)));
    refresh();
})();
