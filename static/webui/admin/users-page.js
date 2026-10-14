(() => {
    const root = document.getElementById("users-route");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    let users = [];
    let loadSequence = 0;

    const userSearch = find("#admin-users-search");
    const userRows = find("#registered-losers");
    const usernameList = document.getElementById("datalist-usernames");

    function showAccessDenied() {
        window.is_admin = false;
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.remove("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.add("d-none"));
    }

    function showAdminContent() {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.add("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.remove("d-none"));
    }

    function appendBadge(parent, text, variant) {
        const badge = document.createElement("span");
        badge.className = `badge text-bg-${variant}`;
        badge.textContent = text;
        parent.append(badge);
    }

    function makeUserRow(user) {
        const row = document.createElement("tr");
        row.dataset.userSearch = `${user.DisplayName} ${user.id}`.toLocaleLowerCase();

        const account = row.insertCell();
        account.className = "users-account-cell";
        const displayName = document.createElement("strong");
        displayName.className = "users-display-name";
        displayName.textContent = user.DisplayName;
        account.append(displayName);

        const idCell = row.insertCell();
        const idCode = document.createElement("code");
        idCode.className = "users-account-id";
        idCode.textContent = user.id;
        idCell.append(idCode);

        const statusCell = row.insertCell();
        statusCell.className = "users-status-cell";
        if (user.Banned) appendBadge(statusCell, loc("admin_banned"), "danger");
        if (user.IsAdministrator) appendBadge(statusCell, loc("admin_administrator"), "secondary");
        if (!user.Banned && !user.IsAdministrator) {
            const status = document.createElement("span");
            status.className = "text-body-secondary";
            status.textContent = "—";
            statusCell.append(status);
        }

        const actions = row.insertCell();
        actions.className = "users-actions-cell";
        if (window.accountId != user.id) {
            const possess = document.createElement("button");
            possess.type = "button";
            possess.className = "btn btn-sm btn-outline-secondary";
            possess.innerHTML = '<i class="bi bi-person-bounding-box" aria-hidden="true"></i>';
            possess.title = loc("admin_possess");
            possess.setAttribute("aria-label", `${loc("admin_possess")}: ${user.DisplayName}`);
            possess.addEventListener("click", () => {
                localStorage.setItem("possessing", user.id);
                doAccountSwitch("/webui/inventory");
            });
            actions.append(possess);
        }
        if (!user.IsAdministrator) {
            const ban = document.createElement("button");
            ban.type = "button";
            ban.className = `btn btn-sm ${user.Banned ? "btn-outline-success" : "btn-outline-danger"}`;
            ban.textContent = loc(user.Banned ? "admin_unban" : "admin_ban");
            ban.addEventListener("click", () => void toggleBan(user, ban));
            actions.append(ban);
        }
        return row;
    }

    function renderUsers() {
        const query = userSearch.value.trim().toLocaleLowerCase();
        const visibleUsers = users.filter(
            user => !query || `${user.DisplayName} ${user.id}`.toLocaleLowerCase().includes(query)
        );
        userRows.replaceChildren(...visibleUsers.map(makeUserRow));

        find("#admin-users-total").textContent = String(users.length);
        find("#admin-users-admin-count").textContent = String(users.filter(user => user.IsAdministrator).length);
        find("#admin-users-banned-count").textContent = String(users.filter(user => user.Banned).length);
        find("#admin-users-visible-count").textContent = String(visibleUsers.length);
        find("#admin-users-empty").classList.toggle("d-none", visibleUsers.length > 0);
        find("#admin-users-clear-search").classList.toggle("d-none", !query);
    }

    function populateUsernameDatalist() {
        const options = [document.createElement("option")];
        options[0].value = "all";
        for (const user of users) {
            const option = document.createElement("option");
            option.value = user.DisplayName;
            options.push(option);
        }
        usernameList.replaceChildren(...options);
    }

    async function loadUsers() {
        const request = ++loadSequence;
        find("#admin-users-refresh").disabled = true;
        find("#admin-users-empty").classList.add("d-none");
        try {
            await awaitAuthz();
            const data = await window.adminUsersApi.list();
            if (request !== loadSequence) return;
            window.is_admin = true;
            users = data ?? [];
            showAdminContent();
            populateUsernameDatalist();
            renderUsers();
        } catch (error) {
            if (request !== loadSequence) return;
            if (error.responseText === "Log-in expired") {
                if (ws_is_open && !auth_pending) {
                    console.warn("Credentials invalidated but the server didn't let us know");
                    sendAuth();
                }
                await revalidateAuthz();
                if (single.getCurrentPath() === "/webui/users") single.loadRoute("/webui/users");
            } else {
                showAccessDenied();
            }
        } finally {
            if (request === loadSequence) find("#admin-users-refresh").disabled = false;
        }
    }

    async function toggleBan(user, button) {
        const banned = !user.Banned;
        const prompt = loc(banned ? "admin_banConfirm" : "admin_unbanConfirm").replace("|TARGET|", user.DisplayName);
        const confirmed = await window.webuiComponents.confirm({
            title: loc(banned ? "admin_ban" : "admin_unban"),
            message: prompt,
            variant: banned ? "danger" : "primary",
            icon: banned ? "bi-person-fill-slash" : "bi-person-check"
        });
        if (!confirmed) return;

        button.disabled = true;
        try {
            await revalidateAuthz();
            await window.suspicionApi.ban(user.id, banned);
            toast(loc("admin_banDone").replace("|TARGET|", user.DisplayName), "success");
            await loadUsers();
        } catch (error) {
            toast(error.responseText || error.message || loc("settings_changeFailed"), "danger");
            button.disabled = false;
        }
    }

    async function sendInboxBroadcast(event) {
        event.preventDefault();
        const sender = find("#admin-message-sender");
        const subject = find("#admin-message-subject");
        const body = find("#admin-message-body");
        const target = find("#admin-message-target");
        const countedAttInput = find("#admin-message-counted-att");
        const button = find("#admin-broadcast-submit");

        [sender, subject, body, target, countedAttInput].forEach(input => input.classList.remove("is-invalid"));
        if (!sender.value.trim() || !subject.value.trim() || !body.value.trim() || !target.value.trim()) {
            [sender, subject, body, target].forEach(input => {
                if (!input.value.trim()) input.classList.add("is-invalid");
            });
            return;
        }

        const countedAttRaw = countedAttInput.value.trim();
        let countedAttachments;
        if (countedAttRaw) {
            try {
                countedAttachments = JSON.parse(countedAttRaw);
            } catch {
                countedAttachments = undefined;
            }
            if (!Array.isArray(countedAttachments)) {
                countedAttInput.classList.add("is-invalid");
                countedAttInput.focus();
                return;
            }
        }

        target.oninput?.();
        const targets = (target.getAttribute("data-tags-value") ?? "").split(", ").filter(Boolean);
        const targetIds =
            targets[0] === "all"
                ? users.map(user => user.id)
                : users.filter(user => targets.includes(user.DisplayName)).map(user => user.id);
        if (!targetIds.length) {
            toast(loc("code_nothingToDo"));
            return;
        }

        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_sendInboxMessage"),
            message: replacePluralForms(loc("admin_sendConfirm"), { COUNT: targetIds.length }),
            variant: "primary",
            icon: "bi-send"
        });
        if (!confirmed) return;

        const attachments = find("#admin-message-att")
            .value.split("\n")
            .map(value => value.trim())
            .filter(Boolean);
        const message = {
            sndr: sender.value.trim(),
            sub: subject.value.trim(),
            msg: body.value.trim(),
            highPriority: find("#admin-message-high-priority").checked
        };
        const icon = find("#admin-message-icon").value.trim();
        if (icon) message.icon = icon;
        if (attachments.length) message.att = attachments;
        if (countedAttachments?.length) message.countedAtt = countedAttachments;

        button.disabled = true;
        try {
            await revalidateAuthz();
            await window.adminUsersApi.broadcastInbox({ targetIds, messages: [message] });
            toast(replacePluralForms(loc("admin_sendToAllSuccess"), { COUNT: targetIds.length }), "success");
        } catch (error) {
            toast(error.responseText || error.message || loc("settings_changeFailed"), "danger");
        } finally {
            button.disabled = false;
        }
    }

    function showIrcNotice(text, type) {
        const notice = find("#admin-irc-notice");
        notice.textContent = text;
        notice.className = `alert alert-${type}`;
    }

    async function sendIrcAnnouncement(event) {
        event.preventDefault();
        const input = find("#admin-irc-message");
        const button = find("#admin-irc-submit");
        const message = input.value.trim();
        if (!message || /[\x00-\x1f\x7f]/.test(message) || new TextEncoder().encode(message).length > 400) {
            showIrcNotice(loc("admin_ircInvalid"), "danger");
            input.focus();
            return;
        }

        const confirmed = await window.webuiComponents.confirm({
            title: loc("admin_ircTitle"),
            message: loc("admin_ircConfirm"),
            variant: "primary",
            icon: "bi-megaphone"
        });
        if (!confirmed) return;

        button.disabled = true;
        find("#admin-irc-notice").classList.add("d-none");
        try {
            await revalidateAuthz();
            await awaitAuthz();
            await window.adminUsersApi.announceIrc(message);
            input.value = "";
            updateIrcByteCount();
            showIrcNotice(loc("admin_ircSent"), "success");
        } catch (error) {
            const errorKey = error.status === 502 ? "admin_ircUnavailable" : "admin_ircFailed";
            showIrcNotice(loc(errorKey), "danger");
        } finally {
            button.disabled = false;
        }
    }

    function updateIrcByteCount() {
        const message = find("#admin-irc-message").value;
        const length = new TextEncoder().encode(message).length;
        const counter = find("#admin-irc-byte-count");
        counter.textContent = `${length} / 400`;
        counter.classList.toggle("text-danger", length > 400);
    }

    userSearch.addEventListener("input", renderUsers);
    root.querySelectorAll("#admin-broadcast-form input, #admin-broadcast-form textarea").forEach(input => {
        input.addEventListener("input", () => input.classList.remove("is-invalid"));
    });
    find("#admin-users-clear-search").addEventListener("click", () => {
        userSearch.value = "";
        renderUsers();
        userSearch.focus();
    });
    find("#admin-users-refresh").addEventListener("click", () => void loadUsers());
    find("#admin-broadcast-form").addEventListener("submit", event => void sendInboxBroadcast(event));
    find("#admin-irc-form").addEventListener("submit", event => void sendIrcAnnouncement(event));
    find("#admin-irc-message").addEventListener("input", updateIrcByteCount);
    single.getRoute("/webui/users").on("beforeload", () => void loadUsers());
})();
