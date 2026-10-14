const uiConfigElements = [...$(".config-form input[id], .config-form select[id], .config-form textarea[id]")];
const uiConfigs = uiConfigElements.map(x => x.dataset.configId || x.id);

for (const [index, id] of uiConfigs.entries()) {
    const elm = uiConfigElements[index];
    if (elm.closest("#global-account-cheats")) continue;

    if (elm.tagName == "SELECT") {
        elm.onchange = function () {
            let value = this.value;
            if (value == "true") {
                value = true;
            } else if (value == "false") {
                value = false;
            } else if (value == "null") {
                value = null;
            } else if (!isNaN(parseInt(value))) {
                value = parseInt(value);
            }
            $.post({
                url: "/custom/setConfig?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify({ [id]: value })
            }).done(function () {
                config_data[id] = value;
            });
        };
    } else if (elm.type == "checkbox") {
        elm.onchange = function () {
            const value = this.checked;
            const isGlobalStarChart = id == "unlockAllMissionsForNewAccounts";
            if (isGlobalStarChart) this.disabled = true;
            const request = $.post({
                url: "/custom/setConfig?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify({ [id]: value })
            }).done(function () {
                config_data[id] = value;
            });
            if (isGlobalStarChart) {
                request
                    .fail(() => {
                        config_data = undefined;
                        getServerConfig().then(applyServerConfig);
                        toast(loc("settings_changeFailed"));
                    })
                    .always(() => {
                        elm.disabled = false;
                    });
            }
        };
    }
}

function updateVarziaRotationControls() {
    const enabled = document.getElementById("worldState.varziaCustomRotationEnabled");
    const mode = document.getElementById("worldState.varziaCustomRotationMode");
    const days = document.getElementById("worldState.varziaCustomRotationDays");
    if (!enabled || !mode || !days) return;
    mode.disabled = !enabled.checked;
    days.disabled = !enabled.checked || mode.value != "custom";
}

document
    .getElementById("worldState.varziaCustomRotationEnabled")
    ?.addEventListener("change", updateVarziaRotationControls);
document
    .getElementById("worldState.varziaCustomRotationMode")
    ?.addEventListener("change", updateVarziaRotationControls);

document.querySelectorAll(".config-form .input-group").forEach(grp => {
    if (grp.closest("#global-account-cheats")) return;
    const input = grp.querySelector("input, select");
    const btn = grp.querySelector("button");
    if (!input || !btn) return;
    input.oninput = input.onchange = function () {
        btn.classList.remove("btn-secondary");
        btn.classList.add("btn-primary");
    };
    btn.onclick = function () {
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-secondary");
    };
});

function doSaveConfigInt(id) {
    const value = parseInt(document.getElementById(id).value);
    $.post({
        url: "/custom/setConfig?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ [id]: value })
    }).done(function () {
        config_data[id] = value;
    });
}

function doSaveConfigFloat(id) {
    const value = parseFloat(document.getElementById(id).value);
    $.post({
        url: "/custom/setConfig?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ [id]: value })
    }).done(function () {
        config_data[id] = value;
    });
}

function doSaveConfigString(id) {
    const value = document.getElementById(id).value.trim();
    $.post({
        url: "/custom/setConfig?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ [id]: value })
    }).done(function () {
        config_data[id] = value;
    });
}

function doSaveConfigDateTime(id) {
    const input = document.getElementById(id);
    const date = input.value ? new Date(input.value) : undefined;
    const value = date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
    $.post({
        url: "/custom/setConfig?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ [id]: value })
    }).done(function () {
        config_data[id] = value;
    });
}

function doSaveConfigStringArray(id) {
    const value = document
        .getElementById(id)
        .getAttribute("data-tags-value")
        .split(", ")
        .filter(x => x);
    $.post({
        url: "/custom/setConfig?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ [id]: value })
    }).done(function () {
        config_data[id] = value;
    });
}

// Assumes that caller revalidates authz.
function getServerConfig() {
    return new Promise((resolve, reject) => {
        if (window.is_admin === false) {
            config_data = null;
        }
        if (config_data !== undefined) {
            resolve(config_data);
        } else {
            $.post({
                url: "/custom/getConfig?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify(uiConfigs)
            })
                .done(json => {
                    window.is_admin = !!json;
                    config_data = json;
                    resolve(config_data);
                })
                .fail(res => reject(res.responseText));
        }
    });
}

/**
 * Show admin-only sections and apply a /custom/getConfig response to matching controls.
 *
 * @returns whether the caller is an administrator.
 */
function applyServerConfig(json) {
    if (!json) {
        $(".admin-hide").removeClass("d-none");
        $(".admin-show").addClass("d-none");
        return false;
    }
    $(".admin-hide").addClass("d-none");
    $(".admin-show").removeClass("d-none");
    Object.entries(json).forEach(entry => {
        const [key, value] = entry;
        const elm =
            document.getElementById(key) ||
            [...document.querySelectorAll("[data-config-id]")].find(candidate => candidate.dataset.configId == key);
        if (!elm) return;
        if (elm.type == "checkbox") {
            elm.checked = value;
        } else if (elm.classList.contains("tags-input")) {
            elm.value = (value ?? []).join(", ");
            elm.oninput();
        } else if (elm.type == "datetime-local") {
            const date = value ? new Date(value) : undefined;
            elm.value =
                date && Number.isFinite(date.getTime())
                    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                    : "";
        } else {
            elm.value = value ?? elm.getAttribute("data-default");
        }
    });
    updateVarziaRotationControls();
    return true;
}
