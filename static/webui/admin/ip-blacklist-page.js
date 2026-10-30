(() => {
    const route = "/webui/ip-blacklist";
    const root = document.getElementById("ip-blacklist-route");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const state = { addresses: [] };

    const showAccessDenied = () => {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.remove("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.add("d-none"));
    };

    const showAdminContent = () => {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.add("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.remove("d-none"));
    };

    const setNotice = (message, variant = "info") => {
        const notice = find("#ip-blacklist-notice");
        notice.textContent = message || "";
        notice.className = `alert ip-blacklist-notice alert-${variant} ${message ? "" : "d-none"}`;
    };

    const render = () => {
        const body = find("#ip-blacklist-entries");
        const empty = find("#ip-blacklist-empty");
        const count = find("#ip-blacklist-count");
        body.replaceChildren();
        count.textContent = loc("ipBlacklist_count").replace("|COUNT|", String(state.addresses.length));
        empty.classList.toggle("d-none", state.addresses.length > 0);

        for (const address of state.addresses) {
            const row = document.createElement("tr");
            const addressCell = row.insertCell();
            const code = document.createElement("code");
            code.textContent = address;
            addressCell.append(code);

            const actionCell = row.insertCell();
            actionCell.className = "text-end";
            const remove = document.createElement("button");
            remove.className = "btn btn-sm btn-outline-danger";
            remove.type = "button";
            remove.title = loc("ipBlacklist_remove");
            remove.setAttribute("aria-label", loc("ipBlacklist_remove"));
            remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
            remove.addEventListener("click", () => removeAddress(address));
            actionCell.append(remove);
            body.append(row);
        }
    };

    const applyResponse = response => {
        state.addresses = Array.isArray(response?.blockedClientAddresses) ? response.blockedClientAddresses : [];
        render();
    };

    const addAddress = event => {
        event.preventDefault();
        const input = find("#ip-blacklist-address");
        const button = find("#ip-blacklist-add");
        const address = input.value.trim();
        if (!address) {
            setNotice(loc("ipBlacklist_invalid"), "danger");
            return;
        }
        button.disabled = true;
        window.ipBlacklistApi
            .add(address)
            .done(response => {
                applyResponse(response);
                input.value = "";
                setNotice(loc("ipBlacklist_added"), "success");
            })
            .fail(response => setNotice(response.responseText || loc("ipBlacklist_saveFailed"), "danger"))
            .always(() => {
                button.disabled = false;
            });
    };

    const removeAddress = address => {
        if (!window.confirm(loc("ipBlacklist_removeConfirm").replace("|ADDRESS|", address))) return;
        window.ipBlacklistApi
            .remove(address)
            .done(response => {
                applyResponse(response);
                setNotice(loc("ipBlacklist_removed"), "success");
            })
            .fail(response => setNotice(response.responseText || loc("ipBlacklist_saveFailed"), "danger"));
    };

    find("#ip-blacklist-add-form").addEventListener("submit", addAddress);

    single.getRoute(route).on("beforeload", () => {
        void awaitAuthz()
            .then(() =>
                window.ipBlacklistApi
                    .get()
                    .done(response => {
                        showAdminContent();
                        applyResponse(response);
                        setNotice("");
                    })
                    .fail(response => {
                        showAccessDenied();
                        setNotice(response.responseText || loc("ipBlacklist_loadFailed"), "danger");
                    })
            )
            .catch(error => {
                showAccessDenied();
                setNotice(error.responseText || loc("ipBlacklist_loadFailed"), "danger");
            });
    });
})();
