(() => {
    const root = document.getElementById("users-route");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    let users = [];
    let loadSequence = 0;

    const userSearch = find("#admin-users-search");
    const userRows = find("#registered-losers");
    const usernameList = document.getElementById("datalist-usernames");
    const attachmentStates = {
        plain: [],
        counted: []
    };
    const attachmentEditors = [
        {
            key: "plain",
            search: find("#admin-message-att-search"),
            add: find("#admin-message-att-add"),
            results: find("#admin-message-att-results"),
            list: find("#admin-message-att-list"),
            empty: find("#admin-message-att-empty"),
            count: find("#admin-message-att-count"),
            counted: false
        },
        {
            key: "counted",
            search: find("#admin-message-counted-att-search"),
            add: find("#admin-message-counted-att-add"),
            results: find("#admin-message-counted-att-results"),
            list: find("#admin-message-counted-att-list"),
            empty: find("#admin-message-counted-att-empty"),
            count: find("#admin-message-counted-att-count"),
            counted: true
        }
    ];
    let attachmentCatalogPromise;

    const normalizeAttachmentSearch = value =>
        String(value ?? "")
            .normalize("NFKD")
            .toLocaleLowerCase()
            .trim();

    const getAttachmentItems = () => window.adminItemCatalog?.items ?? [];
    const getAttachmentItem = itemType => getAttachmentItems().find(item => item.uniqueName === itemType);
    const getAttachmentLabel = itemType => getAttachmentItem(itemType)?.name ?? itemType.split("/").pop() ?? itemType;

    const getAttachmentMatches = query => {
        const normalizedQuery = normalizeAttachmentSearch(query);
        if (!normalizedQuery) return [];
        return getAttachmentItems()
            .filter(item => item.searchText.includes(normalizedQuery))
            .sort((left, right) => {
                const rank = item =>
                    normalizeAttachmentSearch(item.uniqueName) === normalizedQuery
                        ? 0
                        : normalizeAttachmentSearch(item.name).startsWith(normalizedQuery)
                          ? 1
                          : normalizeAttachmentSearch(item.uniqueName).startsWith(normalizedQuery)
                            ? 2
                            : 3;
                return rank(left) - rank(right) || left.name.localeCompare(right.name);
            })
            .slice(0, 30);
    };

    const hasExactAttachmentItem = query =>
        getAttachmentItems().some(
            item => normalizeAttachmentSearch(item.uniqueName) === normalizeAttachmentSearch(query)
        );

    const updateAttachmentAddButton = editor => {
        const query = editor.search.value.trim();
        editor.add.disabled = !query || (!hasExactAttachmentItem(query) && !query.startsWith("/"));
    };

    const renderAttachmentResults = editor => {
        const query = editor.search.value.trim();
        editor.results.replaceChildren();
        updateAttachmentAddButton(editor);
        if (!query) {
            editor.results.classList.add("d-none");
            return;
        }

        const matches = getAttachmentMatches(query);
        for (const item of matches) {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "list-group-item list-group-item-action users-attachment-result";
            option.setAttribute("role", "option");
            const name = document.createElement("strong");
            name.textContent = item.name;
            const path = document.createElement("code");
            path.textContent = item.uniqueName;
            option.append(name, path);
            option.addEventListener("mousedown", event => {
                event.preventDefault();
                addAttachment(editor, item.uniqueName);
            });
            editor.results.append(option);
        }

        if (!matches.length) {
            const empty = document.createElement("div");
            empty.className = "users-attachment-no-results";
            empty.textContent = loc("admin_messageNoAttachmentMatches");
            editor.results.append(empty);
        }
        editor.results.classList.remove("d-none");
    };

    const renderAttachmentCount = editor => {
        const items = attachmentStates[editor.key];
        if (!editor.counted) {
            editor.count.textContent = loc("admin_messageAttachmentCount").replace("|COUNT|", String(items.length));
            return;
        }
        const total = items.reduce((sum, item) => sum + (item.itemCount > 0 ? item.itemCount : 0), 0);
        editor.count.textContent = loc("admin_messageCountedAttachmentCount")
            .replace("|COUNT|", String(items.length))
            .replace("|TOTAL|", total.toLocaleString());
    };

    const renderAttachmentEditor = editor => {
        const items = attachmentStates[editor.key];
        editor.list.replaceChildren(
            ...items.map((item, index) => {
                const row = document.createElement("div");
                row.className = "users-attachment-row";

                const details = document.createElement("div");
                details.className = "users-attachment-details";
                const name = document.createElement("strong");
                name.textContent = getAttachmentLabel(item.itemType ?? item);
                const path = document.createElement("code");
                path.textContent = item.itemType ?? item;
                details.append(name, path);

                if (editor.counted) {
                    const quantity = document.createElement("input");
                    quantity.className = "form-control users-attachment-quantity";
                    quantity.type = "number";
                    quantity.min = "1";
                    quantity.step = "1";
                    quantity.value = String(item.itemCount);
                    quantity.setAttribute(
                        "aria-label",
                        `${loc("admin_messageQuantity")}: ${getAttachmentLabel(item.itemType)}`
                    );
                    quantity.addEventListener("input", () => {
                        const value = Number(quantity.value);
                        item.itemCount = Number.isSafeInteger(value) && value > 0 ? value : 0;
                        renderAttachmentCount(editor);
                    });
                    row.append(details, quantity);
                } else {
                    row.append(details);
                }

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "btn btn-sm btn-outline-danger users-attachment-remove";
                remove.title = loc("code_remove");
                remove.setAttribute(
                    "aria-label",
                    `${loc("code_remove")}: ${getAttachmentLabel(item.itemType ?? item)}`
                );
                remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
                remove.addEventListener("click", () => {
                    attachmentStates[editor.key].splice(index, 1);
                    renderAttachmentEditor(editor);
                });
                row.append(remove);
                return row;
            })
        );
        editor.empty.classList.toggle("d-none", items.length > 0);
        renderAttachmentCount(editor);
        renderAttachmentResults(editor);
    };

    function addAttachment(editor, itemType = editor.search.value) {
        const value = itemType.trim();
        if (!value) return false;
        const items = attachmentStates[editor.key];
        if (editor.counted) {
            const existing = items.find(item => item.itemType === value);
            if (existing) existing.itemCount += 1;
            else items.push({ itemType: value, itemCount: 1 });
        } else if (!items.includes(value)) {
            items.push(value);
        }
        editor.search.value = "";
        renderAttachmentEditor(editor);
        editor.search.focus();
        return true;
    }

    const initializeAttachmentEditors = () => {
        for (const editor of attachmentEditors) {
            editor.search.addEventListener("input", () => renderAttachmentResults(editor));
            editor.search.addEventListener("focus", () => renderAttachmentResults(editor));
            editor.search.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    const firstMatch = getAttachmentMatches(editor.search.value)[0];
                    if (firstMatch) addAttachment(editor, firstMatch.uniqueName);
                    else if (!editor.add.disabled) addAttachment(editor);
                } else if (event.key === "Escape") {
                    editor.results.classList.add("d-none");
                }
            });
            editor.search.addEventListener("blur", () => {
                setTimeout(() => editor.results.classList.add("d-none"), 150);
            });
            editor.add.addEventListener("click", () => addAttachment(editor));
            renderAttachmentEditor(editor);
        }
    };

    const loadAttachmentCatalog = async () => {
        if (!window.adminItemCatalog?.load) return;
        const language = window.lang ?? "en";
        if (!attachmentCatalogPromise || attachmentCatalogPromise.language !== language) {
            attachmentCatalogPromise = {
                language,
                promise: window.adminItemCatalog.load(language).catch(() => undefined)
            };
        }
        await attachmentCatalogPromise.promise;
        attachmentEditors.forEach(renderAttachmentEditor);
    };

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
        options[0].textContent = "all";
        for (const user of users) {
            const option = document.createElement("option");
            option.value = user.DisplayName;
            option.textContent = user.DisplayName;
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
        const button = find("#admin-broadcast-submit");

        [sender, subject, body, target].forEach(input => input.classList.remove("is-invalid"));
        if (!sender.value.trim() || !subject.value.trim() || !body.value.trim() || !target.value.trim()) {
            [sender, subject, body, target].forEach(input => {
                if (!input.value.trim()) input.classList.add("is-invalid");
            });
            return;
        }

        if (attachmentStates.counted.some(item => !Number.isSafeInteger(item.itemCount) || item.itemCount < 1)) {
            toast(loc("admin_messageInvalidQuantity"), "danger");
            return;
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

        const attachments = attachmentStates.plain;
        const countedAttachments = attachmentStates.counted;
        const message = {
            sndr: sender.value.trim(),
            sub: subject.value.trim(),
            msg: body.value.trim(),
            highPriority: find("#admin-message-high-priority").checked
        };
        const icon = find("#admin-message-icon").value.trim();
        if (icon) message.icon = icon;
        if (attachments.length) message.att = attachments;
        if (countedAttachments.length) {
            message.countedAtt = countedAttachments.map(item => ({
                ItemType: item.itemType,
                ItemCount: item.itemCount
            }));
        }

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
    initializeAttachmentEditors();
    document.addEventListener?.("webui:translations-ready", () => {
        attachmentEditors.forEach(renderAttachmentEditor);
    });
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
    single.getRoute("/webui/users").on("beforeload", () => {
        void loadUsers();
        void loadAttachmentCatalog();
    });
})();
