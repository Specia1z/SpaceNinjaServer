/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

const webUITranslations = ["en", "ru", "fr", "de", "zh", "es", "uk", "pl"];
const allPermissions = [];

// Currencies are addressed by inventory field name rather than unique name, so they have no localised entry in
// the item search index and would otherwise render as a bare identifier. Declared up here because the search
// index is built during startup, well before the admin screens are wired up.
const CURRENCY_LABELS = {
    RegularCredits: "currency_RegularCredits",
    PremiumCredits: "currency_PremiumCredits",
    PremiumCreditsFree: "currency_PremiumCreditsFree",
    FusionPoints: "currency_FusionPoints",
    CrewShipFusionPoints: "currency_CrewShipFusionPoints",
    PrimeTokens: "currency_PrimeTokens"
};
document.querySelectorAll("[data-enabling-permission]").forEach(elm => {
    const perm = elm.getAttribute("data-enabling-permission");
    if (allPermissions.indexOf(perm) == -1) {
        allPermissions.push(perm);
    }
});

let auth_pending = false,
    ws_is_open = false,
    wsid = 0,
    ws_reconnect = false;
let config_data;
const sendAuth = isRegister => {
    if (ws_is_open && localStorage.getItem("email") && localStorage.getItem("password")) {
        auth_pending = true;
        window.ws.send(
            JSON.stringify({
                auth: {
                    email: localStorage.getItem("email").toLowerCase(),
                    password: wp.encSync(localStorage.getItem("password")),
                    possessing: localStorage.getItem("possessing"),
                    isRegister,
                    allPermissions
                }
            })
        );
        return true;
    }
    return false;
};

function openWebSocket() {
    const wsProto = location.protocol === "https:" ? "wss://" : "ws://";
    window.ws = new WebSocket(wsProto + location.host + "/custom/ws");
    window.ws.onopen = () => {
        ws_is_open = true;
        sendAuth(false);
    };
    window.ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if ("wsid" in msg) {
            wsid = msg.wsid;
        }
        if ("reload" in msg) {
            setTimeout(() => {
                getWebSocket().then(() => {
                    location.reload();
                });
            }, 100);
        }
        if ("ports" in msg) {
            location.port = location.protocol == "https:" ? msg.ports.https : msg.ports.http;
        }
        if ("config_reloaded" in msg) {
            refreshServerConfig();
            if (window.authz) {
                // Our permissions may have changed, so resync them with the server.
                ws.send(JSON.stringify({ allPermissions }));
            }
        }
        if ("auth_succ" in msg) {
            auth_pending = false;
            const data = msg.auth_succ;
            if (single.getCurrentPath() == "/webui/") {
                single.loadRoute("/webui/inventory");
            }
            $("#email").val("");
            $("#password").val("");
            $(".displayname").text(data.DisplayName);
            window.accountId = data.id;
            window.authz = "accountId=";
            let possessing = localStorage.getItem("possessing");
            if (possessing == data.id) {
                localStorage.removeItem("possessing");
                possessing = null;
            }
            if (possessing) {
                window.accountId = possessing;
                window.authz += possessing + "&possesser=";
            }
            window.authz += data.id + "&nonce=" + data.Nonce + "&wsid=" + wsid;
            if (window.dict) {
                updateLocElements();
            }
            if (ws_reconnect) {
                ws_reconnect = false;
                // Anything could've happened during the time we were disconnected and not getting events.
                single.loadRoute(single.getCurrentPath());
            }
        }
        if ("permissions" in msg) {
            for (const perm of allPermissions) {
                const granted = msg.permissions.indexOf(perm) != -1;
                //console.log(`Permission ${perm} was ${granted ? 'granted' : 'denied'}`);
                document.querySelectorAll(`[data-enabling-permission='${perm}']`).forEach(elm => {
                    elm.disabled = !granted;
                });
            }
        }
        if ("auth_fail" in msg) {
            auth_pending = false;
            if (localStorage.getItem("possessing")) {
                localStorage.removeItem("possessing");
                doAccountSwitch("/webui/users");
            } else {
                logout();
                if (single.getCurrentPath() == "/webui/") {
                    if (msg.auth_fail == "bad login") {
                        alert(loc("code_loginFail"));
                    } else if (msg.auth_fail == "bad register") {
                        alert(loc("code_regFail"));
                    } else if (msg.auth_fail == "rate limited") {
                        alert(loc("code_regRateLimited"));
                    } else if (msg.auth_fail == "admin only") {
                        alert(loc("code_adminOnlyLogin"));
                    } else if (msg.auth_fail == "registered but admin only") {
                        alert(loc("code_adminOnlyRegister"));
                    } else {
                        alert(msg.auth_fail);
                    }
                } else {
                    single.loadRoute("/webui/");
                }
            }
        }
        if ("nonce_updated" in msg) {
            if (!sendAuth()) {
                single.loadRoute("/webui/"); // Show login screen
            }
        }
        if ("update_inventory" in msg) {
            updateInventory();
        }
        if ("update_guild" in msg) {
            updateGuild();
        }
        if ("logged_out" in msg) {
            if (localStorage.getItem("possessing")) {
                localStorage.removeItem("possessing");
                doAccountSwitch("/webui/users");
            } else {
                logout();
                single.loadRoute("/webui/"); // Show login screen
            }
        }
        if ("have_game_ws" in msg) {
            window.have_game_ws = msg.have_game_ws;
            if (window.dict) {
                $(".inventory-update-note").text(
                    loc(msg.have_game_ws ? "general_inventoryUpdateNoteGameWs" : "general_inventoryUpdateNote")
                );
            }
        }
    };
    window.ws.onclose = function () {
        ws_is_open = false;
        ws_reconnect = true;
        invalidateCachedData();
        window.subscribedToGuildId = undefined;
        setTimeout(openWebSocket, 3000);
    };
}
openWebSocket();

function refreshServerConfig() {
    window.is_admin = undefined;
    config_data = undefined;
    if (
        single.getCurrentPath() == "/webui/cheats" ||
        single.getCurrentPath() == "/webui/users" ||
        single.getCurrentPath() == "/webui/account-rates" ||
        single.getCurrentPath() == "/webui/reward-stats" ||
        single.getCurrentPath() == "/webui/metadata-patches" ||
        single.getCurrentPath() == "/webui/bootstrapper-version" ||
        single.getCurrentPath() == "/webui/client-config" ||
        single.getCurrentPath() == "/webui/world-activities" ||
        single.getCurrentPath() == "/webui/world-state"
    ) {
        single.loadRoute(single.getCurrentPath());
    }
}

function invalidateCachedData() {
    inventory_data = undefined;
    window.guild_data = undefined;
    window.guildPage?.reset();
    window.is_admin = undefined;
    config_data = undefined;
}

function doAccountSwitch(to_route) {
    window.accountRatesPage?.reset();
    window.rewardStatsPage?.reset();
    window.authz = undefined;
    invalidateCachedData();
    single.loadRoute(to_route);
    sendAuth();
}

function getWebSocket() {
    return new Promise(resolve => {
        let interval;
        interval = setInterval(() => {
            if (ws_is_open) {
                clearInterval(interval);
                resolve(window.ws);
            }
        }, 10);
    });
}

window.registerSubmit = false;

function doLogin() {
    if (auth_pending) {
        return;
    }
    localStorage.setItem("email", $("#email").val());
    localStorage.setItem("password", $("#password").val());
    sendAuth(registerSubmit);
    window.registerSubmit = false;
}

function awaitAuthz(timeout = 15000) {
    return new Promise(resolve => {
        if (window.authz) {
            resolve();
            return;
        }
        if (!localStorage.getItem("email") || !localStorage.getItem("password")) {
            if (single.getCurrentPath() !== "/webui/") {
                single.loadRoute("/webui/");
            }
            return;
        }

        let interval;
        const finish = () => {
            clearInterval(interval);
            clearTimeout(timeoutId);
            resolve();
        };
        const timeoutId = setTimeout(() => {
            if (window.authz) {
                finish();
                return;
            }

            console.warn("WebUI authentication did not complete before the route loaded");
            clearInterval(interval);
            if (single.getCurrentPath() !== "/webui/") {
                single.loadRoute("/webui/");
            }
        }, timeout);

        interval = setInterval(() => {
            if (window.authz) finish();
        }, 10);
    });
}

function revalidateAuthz() {
    return new Promise(resolve => {
        let interval;
        interval = setInterval(() => {
            if (ws_is_open && !auth_pending) {
                clearInterval(interval);
                resolve();
            }
        }, 10);
    });
}

function logout() {
    window.accountRatesPage?.reset();
    window.rewardStatsPage?.reset();
    localStorage.removeItem("email");
    localStorage.removeItem("password");
    window.authz = undefined;
    invalidateCachedData();
}

function doLogout() {
    if (localStorage.getItem("possessing")) {
        localStorage.removeItem("possessing");
        doAccountSwitch("/webui/users");
    } else {
        logout();
        if (ws_is_open) {
            // Unsubscribe from notifications about nonce invalidation
            window.ws.send(JSON.stringify({ logout: true }));
        }
        location.href = "/webui/";
    }
}

async function renameAccount(taken_name) {
    const newname = await window.webuiComponents.prompt({
        title: localStorage.getItem("possessing") ? loc("code_rename") : loc("navbar_renameAccount"),
        message: `${taken_name ? loc("code_changeNameRetry").replace("|NAME|", taken_name) + " " : ""}${loc("code_changeNameConfirm")}`,
        defaultValue: taken_name || "",
        confirmLabel: loc("ui_save")
    });
    if (newname) {
        revalidateAuthz().then(() => {
            fetch("/custom/renameAccount?" + window.authz + "&newname=" + encodeURIComponent(newname)).then(res => {
                if (res.status == 200) {
                    $(".displayname").text(newname);
                    updateLocElements();
                    toast(loc("code_succRelog"));
                } else if (res.status == 409) {
                    renameAccount(newname);
                } else {
                    toast(loc("code_genFail"));
                }
            });
        });
    }
}

async function deleteAccount() {
    if (
        await window.webuiComponents.confirm({
            title: loc("navbar_deleteAccount"),
            message: loc(
                localStorage.getItem("possessing") ? "code_deletePossessedAccountConfirm" : "code_deleteAccountConfirm"
            ),
            variant: "danger",
            icon: "bi-person-x"
        })
    ) {
        revalidateAuthz().then(() => {
            fetch("/custom/deleteAccount?" + window.authz);
        });
    }
}

async function changeAccountPassword() {
    const cur = await window.webuiComponents.prompt({
        title: loc("navbar_changePassword"),
        message: loc("code_promptCurrentPassword")
    });
    if (cur === null) {
        return;
    }
    if (!cur.length) {
        toast(loc("settings_changeFailed"));
        return;
    }
    const nw = await window.webuiComponents.prompt({
        title: loc("navbar_changePassword"),
        message: loc("code_promptNewPassword")
    });
    if (nw === null) {
        return;
    }
    if (!nw.length) {
        toast(loc("settings_changeFailed"));
        return;
    }
    const cf = await window.webuiComponents.prompt({
        title: loc("navbar_changePassword"),
        message: loc("code_promptConfirmNewPassword")
    });
    if (cf === null) {
        return;
    }
    if (nw !== cf) {
        toast(loc("settings_passwordMismatch"));
        return;
    }
    revalidateAuthz().then(() => {
        fetch("/custom/changePassword?" + window.authz, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPassword: wp.encSync(cur),
                newPassword: wp.encSync(nw)
            })
        }).then(res => {
            if (res.status == 200) {
                localStorage.setItem("password", nw);
                res.text().then(text => {
                    toast(loc(text == "noop" ? "code_nothingToDo" : "settings_passwordSuccess"));
                });
            } else if (res.status == 403) {
                toast(loc("settings_wrongPassword"));
            } else {
                toast(loc("settings_changeFailed"));
            }
        });
    });
}

async function changeAccountEmail() {
    const curPw = await window.webuiComponents.prompt({
        title: loc("navbar_changeEmail"),
        message: loc("code_promptCurrentPassword")
    });
    if (curPw === null) {
        return;
    }
    if (!curPw.length) {
        toast(loc("settings_changeFailed"));
        return;
    }
    const currentHash = wp.encSync(curPw);
    async function promptAndSend(conflictEmail) {
        const newEmailRaw = await window.webuiComponents.prompt({
            title: loc("navbar_changeEmail"),
            message: `${conflictEmail ? loc("code_changeEmailRetry").replace("|EMAIL|", conflictEmail) + " " : ""}${loc("code_promptNewEmail")}`
        });
        if (newEmailRaw === null) {
            return;
        }
        const newEmail = newEmailRaw.trim().toLowerCase();
        if (!newEmail.length) {
            toast(loc("settings_changeFailed"));
            return;
        }
        if (!newEmail.includes("@")) {
            toast(loc("settings_changeFailed"));
            return;
        }
        revalidateAuthz().then(() => {
            fetch("/custom/changeEmail?" + window.authz, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: currentHash,
                    newEmail
                })
            }).then(res => {
                if (res.status == 200) {
                    localStorage.setItem("email", newEmail);
                    res.text().then(text => {
                        toast(loc(text == "noop" ? "code_nothingToDo" : "settings_emailSuccess"));
                    });
                } else if (res.status == 403) {
                    toast(loc("settings_wrongPassword"));
                } else if (res.status == 409) {
                    promptAndSend(newEmail);
                } else {
                    toast(loc("settings_changeFailed"));
                }
            });
        });
    }
    promptAndSend();
}

function updateTitle() {
    const route = single.getCurrentRoute();
    if (route) {
        const tag = route.elm.getAttribute("data-title-tag");
        if (tag) {
            document.querySelector("title").textContent = loc(tag) + " | PlayWF WebUI";
        }
    }
}

single.on("route_load", function (event) {
    if (event.route.paths[0] != "/webui/") {
        // Authorised route?
        if (!localStorage.getItem("email")) {
            // Not logged in?
            return single.loadRoute("/webui/"); // Show login screen
        }
        $("body").addClass("logged-in");

        let navPath = event.route.paths[0];
        if (navPath == "/webui/details") {
            const params = new URLSearchParams(window.location.search);
            const category = params.get("productCategory");

            navPath = category == "Upgrades" ? "/webui/mods" : "/webui/inventory";
        }
        $("#sidebar .sidebar-route-link, #sidebar .app-navigation-trigger").removeClass("active");
        const navLink = document.querySelector("#sidebar .sidebar-route-link[href='" + navPath + "']");
        if (navLink) {
            navLink.classList.add("active");
            navLink.closest(".dropdown")?.querySelector(".app-navigation-trigger")?.classList.add("active");
        } else {
            console.warn("No sidebar entry for current route!");
        }
    } else {
        $("body").removeClass("logged-in");
    }

    window.dictPromise.then(() => {
        updateTitle();
    });
});

function loc(tag) {
    return ((window.dict ?? {})[tag] ?? tag)
        .replaceAll("|DISPLAYNAME|", document.querySelector(".displayname").textContent)
        .replaceAll("|EMAIL|", localStorage.getItem("email"));
}

function updateLocElements() {
    document.querySelectorAll("[data-loc]").forEach(elm => {
        elm.innerHTML = loc(elm.getAttribute("data-loc"));
    });
    document.querySelectorAll("[data-loc-placeholder]").forEach(elm => {
        elm.placeholder = loc(elm.getAttribute("data-loc-placeholder"));
    });
    document.querySelectorAll("[data-loc-title]").forEach(elm => {
        elm.title = loc(elm.getAttribute("data-loc-title"));
        if (elm.hasAttribute("aria-label")) elm.setAttribute("aria-label", elm.title);
    });
    $(".inventory-update-note").text(
        loc(window.have_game_ws ? "general_inventoryUpdateNoteGameWs" : "general_inventoryUpdateNote")
    );
    window.itemListPromise.then(itemMap => {
        document.querySelectorAll("[data-loc-itemMap]").forEach(elm => {
            const key = elm.getAttribute("data-loc-itemMap");
            const item = itemMap[key];
            elm.innerHTML = item && item.name ? item.name : key;
        });
        document.querySelectorAll("[data-loc-itemMap-norm]").forEach(elm => {
            const key = elm.getAttribute("data-loc-itemMap-norm");
            const item = itemMap[key];
            elm.innerHTML = item && item.name ? normalizeText(item.name) : key;
        });
        document.querySelectorAll("[data-loc-itemMap-tc]").forEach(elm => {
            const key = elm.getAttribute("data-loc-itemMap-tc");
            const item = itemMap[key];
            elm.innerHTML = item && item.name ? toTitleCase(item.name) : key;
        });
        document.querySelectorAll("[data-loc-inc]").forEach(elm => {
            const incWith = elm
                .getAttribute("data-loc-inc")
                .split("|")
                .map(key => {
                    if (key.startsWith("/")) {
                        return toTitleCase(itemMap[key]?.name ?? key);
                    }
                    return loc(key).replace(/<[^>]+>/g, "");
                })
                .join(", ");
            elm.title = `${loc("worldState_incompatibleWith")} ${incWith}`;
        });
        document.querySelectorAll("[data-loc-replace]").forEach(elm => {
            elm.innerHTML = elm.innerHTML
                .replaceAll("|val|", "|VAL|")
                // de and uk for no reason adds space between value and %
                .replaceAll("|VAL| %", "|VAL|%") // de
                .replaceAll("|VAL|&nbsp;%", "|VAL|%"); // uk
            elm.innerHTML = elm.innerHTML.replace("|VAL|", elm.getAttribute("data-loc-replace"));
            if (elm.getAttribute("data-loc") == "worldState_lunarNewYearEntry") {
                const animal = loc(
                    `worldState_lunarNewYearAnimal${((parseInt(elm.getAttribute("data-loc-replace")) - 4) % 12) + 1}`
                );
                elm.innerHTML = elm.innerHTML.replace("|ANIMAL|", animal);
            }
        });
    });
}

function replacePluralForms(text, values) {
    const webui_lang = webUITranslations.indexOf(window.lang) == -1 ? "en" : lang;
    const pluralRules = new Intl.PluralRules(webui_lang == "tc" ? "zh" : webui_lang); // tc isn't valid code for Intl so use zh instead
    const pluralCategories = pluralRules.resolvedOptions().pluralCategories;

    return text.replace(/\|(\w+)\||\{(\w+):plural:([^{}]+)\}/g, (match, variable, pluralVariable, forms) => {
        if (variable) return values[variable] ?? match;
        const value = Number(values[pluralVariable]);
        const category = pluralRules.select(value);
        const formsList = forms.split("|");
        return formsList[pluralCategories.indexOf(category)] ?? formsList.at(-1);
    });
}

function setActiveLanguage(lang) {
    window.lang = lang;
    const lang_name = document.querySelector("[data-lang=" + lang + "]").textContent;
    document.getElementById("active-lang-name").textContent = lang_name;
    document.querySelector("[data-lang].active").classList.remove("active");
    document.querySelector("[data-lang=" + lang + "]").classList.add("active");

    window.dictPromise = new Promise(resolve => {
        const webui_lang = webUITranslations.indexOf(lang) == -1 ? "en" : lang;
        let script = document.getElementById("translations");
        if (script) document.documentElement.removeChild(script);

        script = document.createElement("script");
        script.id = "translations";
        script.src = "/webui/translations/" + webui_lang + ".js";
        script.onload = function () {
            updateLocElements();
            updateTitle();
            document.dispatchEvent(new CustomEvent("webui:translations-ready", { detail: { lang } }));
            resolve(window.dict);
        };
        script.onerror = function () {
            location.reload();
        };
        document.documentElement.appendChild(script);
    });
}
setActiveLanguage(localStorage.getItem("lang") ?? webui_conf.defaultLanguage ?? "en");

function setLanguage(lang) {
    setActiveLanguage(lang);
    localStorage.setItem("lang", lang);
    if (window.authz) {
        // Not in prelogin state?
        fetchItemList();
        single.loadRoute(single.getCurrentPath());
    }
}

function setActiveTheme(theme) {
    document.documentElement.setAttribute("data-bs-theme", theme);
    document.querySelector("[data-theme].active").classList.remove("active");
    document.querySelector("[data-theme=" + theme + "]").classList.add("active");
}
setActiveTheme(localStorage.getItem("theme") ?? "dark");

function setTheme(theme) {
    setActiveTheme(theme);
    localStorage.setItem("theme", theme);
}

const webUiModularWeapons = [
    "/Lotus/Weapons/Sentients/OperatorAmplifiers/OperatorAmpWeapon",
    "/Lotus/Weapons/Ostron/Melee/LotusModularWeapon",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimary",
    "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondary",
    "/Lotus/Types/Friendly/Pets/MoaPets/MoaPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/VulpineInfestedCatbrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/HornedInfestedCatbrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/ArmoredInfestedCatbrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/VizierPredatorKubrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/PharaohPredatorKubrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/MedjayPredatorKubrowPetPowerSuit"
];

const icons = {
    angleDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
    angleLeft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/></svg>`,
    angleRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/></svg>`,
    angleUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z"/></svg>`,
    arrowRotateRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M463.5 224l8.5 0c13.3 0 24-10.7 24-24l0-128c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8l119.5 0z"/></svg>`,
    arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"/></svg>`,
    chartSimple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M160 80c0-26.5 21.5-48 48-48h32c26.5 0 48 21.5 48 48V432c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V80zM0 272c0-26.5 21.5-48 48-48H80c26.5 0 48 21.5 48 48V432c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V272zM368 96h32c26.5 0 48 21.5 48 48V432c0 26.5-21.5 48-48 48H368c-26.5 0-48-21.5-48-48V144c0-26.5 21.5-48 48-48z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`,
    childReaching: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M256 64A64 64 0 1 0 128 64a64 64 0 1 0 128 0zM152.9 169.3c-23.7-8.4-44.5-24.3-58.8-45.8L74.6 94.2C64.8 79.5 45 75.6 30.2 85.4s-18.7 29.7-8.9 44.4L40.9 159c18.1 27.1 42.8 48.4 71.1 62.4L112 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96 32 0 0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-258.4c29.1-14.2 54.4-36.2 72.7-64.2l18.2-27.9c9.6-14.8 5.4-34.6-9.4-44.3s-34.6-5.5-44.3 9.4L291 122.4c-21.8 33.4-58.9 53.6-98.8 53.6c-12.6 0-24.9-2-36.6-5.8c-.9-.3-1.8-.7-2.7-.9z"/></svg>`,
    circleStop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M464 256A208 208 0 1 0 48 256a208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm192-96l128 0c17.7 0 32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-128 0c-17.7 0-32-14.3-32-32l0-128c0-17.7 14.3-32 32-32z"/></svg>`,
    feather: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M278.5 215.6L23 471c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l57-57h68c49.7 0 97.9-14.4 139-41c11.1-7.2 5.5-23-7.8-23c-5.1 0-9.2-4.1-9.2-9.2c0-4.1 2.7-7.6 6.5-8.8l81-24.3c2.5-.8 4.8-2.1 6.7-4l22.4-22.4c10.1-10.1 2.9-27.3-11.3-27.3l-32.2 0c-5.1 0-9.2-4.1-9.2-9.2c0-4.1 2.7-7.6 6.5-8.8l112-33.6c4-1.2 7.4-3.9 9.3-7.7C506.4 207.6 512 184.1 512 160c0-41-16.3-80.3-45.3-109.3l-5.5-5.5C432.3 16.3 393 0 352 0s-80.3 16.3-109.3 45.3L139 149C91 197 64 262.1 64 330v55.3L253.6 195.8c6.2-6.2 16.4-6.2 22.6 0c5.4 5.4 6.1 13.6 2.2 19.8z"/></svg>`,
    forward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M371.7 43.1C360.1 32 343 28.9 328.3 35.2S304 56 304 72l0 136.3-172.3-165.1C120.1 32 103 28.9 88.3 35.2S64 56 64 72l0 368c0 16 9.6 30.5 24.3 36.8s31.8 3.2 43.4-7.9L304 303.7 304 440c0 16 9.6 30.5 24.3 36.8s31.8 3.2 43.4-7.9l192-184c7.9-7.5 12.3-18 12.3-28.9s-4.5-21.3-12.3-28.9l-192-184z"/></svg>`,
    graduationCap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M48 195.8l209.2 86.1c9.8 4 20.2 6.1 30.8 6.1s21-2.1 30.8-6.1l242.4-99.8c9-3.7 14.8-12.4 14.8-22.1s-5.8-18.4-14.8-22.1L318.8 38.1C309 34.1 298.6 32 288 32s-21 2.1-30.8 6.1L14.8 137.9C5.8 141.6 0 150.3 0 160L0 456c0 13.3 10.7 24 24 24s24-10.7 24-24l0-260.2zm48 71.7L96 384c0 53 86 96 192 96s192-43 192-96l0-116.6-142.9 58.9c-15.6 6.4-32.2 9.7-49.1 9.7s-33.5-3.3-49.1-9.7L96 267.4z"/></svg>`,
    person: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M112 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm40 304l0 128c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-223.1L59.4 304.5c-9.1 15.1-28.8 20-43.9 10.9s-20-28.8-10.9-43.9l58.3-97c17.4-28.9 48.6-46.6 82.3-46.6l29.7 0c33.7 0 64.9 17.7 82.3 46.6l58.3 97c9.1 15.1 4.2 34.8-10.9 43.9s-34.8 4.2-43.9-10.9L232 256.9 232 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-128-16 0z"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M256 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 160-160 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160 160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0 0-160z" /></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 80V229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7H48C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>`,

    note: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM320 200C333.3 200 344 210.7 344 224L344 336C344 349.3 333.3 360 320 360C306.7 360 296 349.3 296 336L296 224C296 210.7 306.7 200 320 200zM293.3 416C292.7 406.1 297.6 396.7 306.1 391.5C314.6 386.4 325.3 386.4 333.8 391.5C342.3 396.7 347.2 406.1 346.6 416C347.2 425.9 342.3 435.3 333.8 440.5C325.3 445.6 314.6 445.6 306.1 440.5C297.6 435.3 292.7 425.9 293.3 416z"/></svg>`
};

const itemToString = item => item.name;
const itemToStringWithSubtype = item => (item.subtype ? item.name + " (" + item.subtype + ")" : item.name);
const itemToStringWithUniqueName = item => item.name + " [" + item.uniqueName.split("/").pop() + "]";

const areItemsUnambiguous = (items, stringifier) => {
    const set = new Set();
    for (const item of items) {
        const str = stringifier(item);
        if (set.has(str)) {
            return false;
        }
        set.add(str);
    }
    return true;
};

function fetchItemList() {
    window.itemListPromise = new Promise(resolve => {
        const gameVersion = localStorage.getItem("adminGameVersion") ?? "latest";
        const req = $.get(
            "/custom/getItemLists?lang=" +
                encodeURIComponent(window.lang) +
                "&gameVersion=" +
                encodeURIComponent(gameVersion)
        );
        req.done(async data => {
            await dictPromise;

            document.querySelectorAll('[id^="datalist-"]').forEach(datalist => {
                if (datalist.id != "datalist-circuitGameModes" && datalist.id != "datalist-usernames") {
                    datalist.innerHTML = "";
                }
            });

            const syndicateNone = document.createElement("option");
            syndicateNone.value = "";
            syndicateNone.textContent = loc("general_none");
            document.getElementById("changeSyndicate").innerHTML = "";
            document.getElementById("changeSyndicate").appendChild(syndicateNone);

            document.getElementById("valenceBonus-innateDamage").innerHTML = "";
            const rememberedVarziaOverride = document.getElementById("worldState.varziaOverride").value;
            document.getElementById("worldState.varziaOverride").innerHTML = "";
            const rememberedNWOverride = document.getElementById("worldState.nightwaveOverride").value;
            document.getElementById("worldState.nightwaveOverride").innerHTML = "";

            const missingAdditionalDict = new Set();

            // AdditionalDict holds /Lotus/Language/... UI labels (rank names, damage types, the clan trade-type
            // "Platinum"), not grantable items. Flattening it in would let an operator pick something that
            // inevitably fails server-side, so it is skipped here and consumed separately via getAddDict.
            const storeItems = new Map();
            Object.entries(data)
                .filter(([type, value]) => type != "AdditionalDict" && Array.isArray(value))
                .flatMap(([, value]) => value)
                .forEach(item => {
                    if (item && item.uniqueName && item.name && !storeItems.has(item.uniqueName)) {
                        storeItems.set(item.uniqueName, item.name);
                    }
                });

            // Index every listed item by localised name so the admin pickers can be searched in the UI language
            // rather than by pasting a unique name. Entries are lower-cased because matching is case-insensitive.
            window.itemSearchIndex = [...storeItems.entries()].map(([uniqueName, name]) => ({
                uniqueName,
                name,
                searchName: name.toLowerCase()
            }));

            // Currencies are not items, so they are absent from the exported data. Add them so operators can find
            // them by name in any picker that funnels through addItem, notably the redeem-code reward field.
            // The field name is searchable too, so pasting "PremiumCredits" from the docs also works.
            for (const [uniqueName, locKey] of Object.entries(CURRENCY_LABELS)) {
                const name = loc(locKey);
                window.itemSearchIndex.push({
                    uniqueName,
                    name,
                    searchName: `${name.toLowerCase()} ${uniqueName.toLowerCase()}`
                });
            }
            window.itemSearchIndex.sort((a, b) => a.name.localeCompare(b.name));

            const getAddDict = locTag => {
                const item = data.AdditionalDict.find(i => i.uniqueName === locTag);
                if (!item) {
                    missingAdditionalDict.add(locTag);
                    return locTag;
                }
                return item.name
                    .replaceAll("|OPEN_COLOR|", "") // ArchonCrystal
                    .replaceAll("|CLOSE_COLOR|", "") // ArchonCrystal
                    .replaceAll(/<.+>/g, "") // Icons
                    .replaceAll("| %", "|%") // de
                    .replaceAll("| %", "|%") // uk
                    .replaceAll("| с", "|с") // uk
                    .replaceAll("| м ", "|м ") // uk
                    .replaceAll("| m ", "|m "); // pl
            };

            // prettier-ignore
            data.archonCrystalUpgrades = {
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeEquilibrium": getAddDict("/Lotus/Language/Items/WarframeModPickupBonusDesc").replaceAll("|val|", "+20"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeEquilibriumMythic": getAddDict("/Lotus/Language/Items/WarframeModPickupBonusDesc").replaceAll("|val|", "+30"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeMeleeCritDamage": getAddDict("/Lotus/Language/Upgrades/MeleeCritDamage").replaceAll("|val|", "+25"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeMeleeCritDamageMythic": getAddDict("/Lotus/Language/Upgrades/MeleeCritDamage").replaceAll("|val|", "+37.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradePrimaryStatusChance": getAddDict("/Lotus/Language/Upgrades/PrimaryStatusChance").replaceAll("|val|", "+25"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradePrimaryStatusChanceMythic": getAddDict("/Lotus/Language/Upgrades/PrimaryStatusChance").replaceAll("|val|", "+37.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeSecondaryCritChance": getAddDict("/Lotus/Language/Upgrades/SecondaryCritChance").replaceAll("|val|", "+25"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeSecondaryCritChanceMythic": getAddDict("/Lotus/Language/Upgrades/SecondaryCritChance").replaceAll("|val|", "+37.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeAbilityDuration": getAddDict("/Lotus/Language/Upgrades/AvatarAbilityDurationModDesc").replaceAll("|val|", "+10"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeAbilityDurationMythic": getAddDict("/Lotus/Language/Upgrades/AvatarAbilityDurationModDesc").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeAbilityStrength": getAddDict("/Lotus/Language/Upgrades/AvatarAbilityStrengthModDesc").replaceAll("|val|", "+10"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeAbilityStrengthMythic": getAddDict("/Lotus/Language/Upgrades/AvatarAbilityStrengthModDesc").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeArmourMax": getAddDict("/Lotus/Language/Upgrades/WarframeArmourMaxFlat").replaceAll("|val|", "+150"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeArmourMaxMythic": getAddDict("/Lotus/Language/Upgrades/WarframeArmourMaxFlat").replaceAll("|val|", "+225"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeBlastProc": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeBlastProcShieldRegen").replaceAll("|val|", "+5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeBlastProcMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeBlastProcShieldRegen").replaceAll("|val|", "+7.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCastingSpeed": getAddDict("/Lotus/Language/Upgrades/AvatarCastingSpeedModDesc").replaceAll("|val|", "+25"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCastingSpeedMythic": getAddDict("/Lotus/Language/Upgrades/AvatarCastingSpeedModDesc").replaceAll("|val|", "+37.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCorrosiveDamageBoost": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeDamageBoostFromCorrosive").replaceAll("|val|", "+10"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCorrosiveDamageBoostMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeDamageBoostFromCorrosive").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCorrosiveStack": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeMaxCorrosiveStack").replaceAll("|val|", "+2"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCorrosiveStackMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeMaxCorrosiveStack").replaceAll("|val|", "+3"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCritDamageBoost": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeMeleeCritDoubledWithMaxEnergy").replaceAll("|val|", "25").replaceAll("|AMOUNT|", "500"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeCritDamageBoostMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeMeleeCritDoubledWithMaxEnergy").replaceAll("|val|", "37").replaceAll("|AMOUNT|", "500"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeElectricDamage": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeElectricDamageFromShards").replaceAll("|val|", "30").replaceAll("|val2|", "+10"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeElectricDamageMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeElectricDamageFromShards").replaceAll("|val|", "45").replaceAll("|val2|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeElectricDamageBoost": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeDamageBoostFromElectricity").replaceAll("|val|", "+10"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeElectricDamageBoostMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeDamageBoostFromElectricity").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeEnergyMax": getAddDict("/Lotus/Language/Upgrades/WarframeEnergyMaxFlat").replaceAll("|val|", "+50"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeEnergyMaxMythic": getAddDict("/Lotus/Language/Upgrades/WarframeEnergyMaxFlat").replaceAll("|val|", "+75"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeGlobeEffectEnergy": getAddDict("/Lotus/Language/Upgrades/WarframeGlobeEffectEnergy").replaceAll("|val|", "+50"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeGlobeEffectEnergyMythic": getAddDict("/Lotus/Language/Upgrades/WarframeGlobeEffectEnergy").replaceAll("|val|", "+75"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeGlobeEffectHealth": getAddDict("/Lotus/Language/Upgrades/WarframeGlobeEffectHealth").replaceAll("|val|", "+100"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeGlobeEffectHealthMythic": getAddDict("/Lotus/Language/Upgrades/WarframeGlobeEffectHealth").replaceAll("|val|", "+150"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeHealthMax": getAddDict("/Lotus/Language/Upgrades/WarframeHealthMaxFlat").replaceAll("|val|", "+150"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeHealthMaxMythic": getAddDict("/Lotus/Language/Upgrades/WarframeHealthMaxFlat").replaceAll("|val|", "+225"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeHPBoostFromImpact": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeImpactHPIncrease").replaceAll("|val|", "1").replaceAll("|max|", "300"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeHPBoostFromImpactMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeImpactHPIncrease").replaceAll("|val|", "2").replaceAll("|max|", "450"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeParkourVelocity": getAddDict("/Lotus/Language/Upgrades/AvatarParkourBoostModDesc").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeParkourVelocityMythic": getAddDict("/Lotus/Language/Upgrades/AvatarParkourBoostModDesc").replaceAll("|val|", "+22.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeRadiationDamageBoost": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeDamageBoostFromRadiation").replaceAll("|val|", "+10"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeRadiationDamageBoostMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeDamageBoostFromRadiation").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeRegen": getAddDict("/Lotus/Language/Upgrades/WarframeHealthRegenFlat").replaceAll("|val|", "+5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeRegenMythic": getAddDict("/Lotus/Language/Upgrades/WarframeHealthRegenFlat").replaceAll("|val|", "+7.5"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeShieldMax": getAddDict("/Lotus/Language/Upgrades/WarframeShieldMaxFlat").replaceAll("|val|", "+150"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeShieldMaxMythic": getAddDict("/Lotus/Language/Upgrades/WarframeShieldMaxFlat").replaceAll("|val|", "+225"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeStartingEnergy": getAddDict("/Lotus/Language/Upgrades/AvatarSpawnEnergyPercent").replaceAll("|val|", "+30"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeStartingEnergyMythic": getAddDict("/Lotus/Language/Upgrades/AvatarSpawnEnergyPercent").replaceAll("|val|", "+45"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeToxinDamage": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeToxinProcDamage").replaceAll("|val|", "+30"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeToxinDamageMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeToxinProcDamage").replaceAll("|val|", "+45"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeToxinHeal": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeRegenHPOnToxinProc").replaceAll("|val|", "+2"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWarframeToxinHealMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeRegenHPOnToxinProc").replaceAll("|val|", "+3"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWeaponCritBoostFromHeat": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeCritBoostFromHeat").replaceAll("|val|", "1").replaceAll("|max|", "50"),
                "/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgradeWeaponCritBoostFromHeatMythic": getAddDict("/Lotus/Language/Alchemy/ArchonUpgradeWarframeCritBoostFromHeat").replaceAll("|val|", "1.5").replaceAll("|max|", "75"),
                "/Lotus/Upgrades/Mods/Warframe/AvatarAbilityRangeMod": getAddDict("/Lotus/Language/Upgrades/AvatarAbilityRangeModDesc").replaceAll("|val|", "+7.5"),
                "/Lotus/Upgrades/Mods/Warframe/AvatarAbilityEfficiencyMod": getAddDict("/Lotus/Language/Upgrades/AvatarAbilityEfficiencyModDesc").replaceAll("|val|", "+5"),
                "/Lotus/Upgrades/Mods/Warframe/AvatarEnergyRegenMod": getAddDict("/Lotus/Language/Upgrades/EnergyRegen").replaceAll("|val|", "+0.5"),
                "/Lotus/Upgrades/Mods/Warframe/AvatarEnemyRadarMod": getAddDict("/Lotus/Language/Upgrades/AvatarEnemyRadarModDesc").replaceAll("|val|", "+5"),
                "/Lotus/Upgrades/Mods/Warframe/AvatarLootRadarMod": getAddDict("/Lotus/Language/Upgrades/AvatarLootRadarModDesc").replaceAll("|val|", "+7"),
                "/Lotus/Upgrades/Mods/Rifle/WeaponAmmoMaxMod": getAddDict("/Lotus/Language/Upgrades/WeaponMaxAmmoModDesc").replaceAll("|val|", "+15"),
                "/Lotus/Upgrades/Mods/Aura/EnemyArmorReductionAuraMod": getAddDict("/Lotus/Language/Upgrades/EnemyArmorReductionAuraDesc").replaceAll("|val|", "-3"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionAmmoMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionAmmo").replaceAll("|AMMO|", "100"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionHealthDropMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionHealth").replaceAll("|CHANCE|", "100"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionEnergyDropMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionEnergy").replaceAll("|CHANCE|", "50"),
                "/Lotus/Upgrades/Mods/DataSpike/Cipher/OnFailHackResetMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnFailRehack").replaceAll("|val|", "+50"),
                "/Lotus/Upgrades/Mods/DataSpike/Cipher/DamageReductionOnHackMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeDamageReduceOnHack").replaceAll("|VAL|", "75"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionReviveCompanionMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionReviveCompanion").replaceAll("|TIME|", "15"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionParkourSpeedMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionParkour").replaceAll("|VAL|", "75").replaceAll("|DURATION|", "12"),
                "/Lotus/Upgrades/Mods/Warframe/AvatarTimeLimitIncreaseMod": getAddDict("/Lotus/Language/Upgrades/TimeLimitIncreaseDesc").replaceAll("|val|", "+8"),
                "/Lotus/Upgrades/Mods/DataSpike/Cipher/ElectrifyOnHackMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeElectrifyHack").replaceAll("|RANGE|", "20"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionTerrifyMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionTerrify").replaceAll("|CHANCE|", "50").replaceAll("|RANGE|", "15").replaceAll("|DURATION|", "8"),
                "/Lotus/Upgrades/Mods/DataSpike/Cipher/OnHackLockersMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnHackLockers").replaceAll("|COUNT|", "5").replaceAll("|RANGE|", "20"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionBlindMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionBlind").replaceAll("|RANGE|", "18"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/OnExecutionDrainPowerMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnExecutionDrainPower").replaceAll("|STRENGTH|", "50"),
                "/Lotus/Upgrades/Mods/DataSpike/Cipher/OnHackSprintSpeedMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnHackSprintSpeed").replaceAll("|VAL|", "75").replaceAll("|DURATION|", "15"),
                "/Lotus/Upgrades/Mods/DataSpike/Assassin/SwiftExecuteMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeSwiftMercy").replaceAll("|SPEED|", "50"),
                "/Lotus/Upgrades/Mods/DataSpike/Cipher/OnHackInvisMod": getAddDict("/Lotus/Language/Upgrades/DataSpikeOnHackInvis").replaceAll("|DURATION|", "15")
            };
            window.archonCrystalUpgrades = data.archonCrystalUpgrades;

            data.innateDamages = {
                InnateElectricityDamage: getAddDict("/Lotus/Language/Game/DT_ELECTRICITY_NoIcon"),
                InnateFreezeDamage: getAddDict("/Lotus/Language/Game/DT_FREEZE_NoIcon"),
                InnateHeatDamage: getAddDict("/Lotus/Language/Game/DT_FIRE_NoIcon"),
                InnateImpactDamage: getAddDict("/Lotus/Language/Game/DT_IMPACT_NoIcon"),
                InnateMagDamage: getAddDict("/Lotus/Language/Game/DT_MAGNETIC_NoIcon"),
                InnateRadDamage: getAddDict("/Lotus/Language/Game/DT_RADIATION_NoIcon"),
                InnateToxinDamage: getAddDict("/Lotus/Language/Game/DT_POISON_NoIcon")
            };

            // Add mods missing in data sources
            data.mods.push(
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/CommonModFuser",
                    name: loc("code_fusionCoreCommon"),
                    fusionLimit: 3
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/UncommonModFuser",
                    name: loc("code_fusionCoreUncommon")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/RareModFuser",
                    name: loc("code_fusionCoreRare")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/LegacyCommonModFuser",
                    name: loc("code_ancientFusionCoreCommon"),
                    fusionLimit: 10
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/LegacyUncommonModFuser",
                    name: loc("code_ancientFusionCoreUncommon"),
                    fusionLimit: 10
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/LegacyRareModFuser",
                    name: loc("code_ancientFusionCoreRare"),
                    fusionLimit: 10
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Fusers/LegendaryModFuser",
                    name: getAddDict("/Lotus/Language/Items/LegendaryFusionPart"),
                    fusionLimit: 0
                },
                {
                    uniqueName: "/Lotus/Upgrades/CosmeticEnhancers/Peculiars/CyoteMod",
                    name: getAddDict("/Lotus/Language/Mods/PerculiarCyoteMod")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Warframe/Intermediate/AvatarPickupBonusModIntermediate",
                    name: getAddDict("/Lotus/Language/Items/WarframeModPickupBonus") + " " + loc("code_badItem")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarStaminaCostMultiplierMod",
                    name: getAddDict("/Lotus/Language/Items/WarframeModStaminaCost")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarShieldToStaminaMod",
                    name: getAddDict("/Lotus/Language/Items/WarframeModShieldToStamina"),
                    fusionLimit: 3
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarStaminaMaxMod",
                    name: getAddDict("/Lotus/Language/Items/WarframeModStaminaMax")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarStaminaRechargeRateMod",
                    name: getAddDict("/Lotus/Language/Items/WarframeModStaminaRechargeRate")
                },
                {
                    uniqueName: "/Lotus/Upgrades/Mods/Melee/WeaponStaminaBonusMod",
                    name: getAddDict("/Lotus/Language/Items/MeleeModStaminaBonus")
                }
            );

            // Add modular weapons
            data.OperatorAmps.push({
                uniqueName: "/Lotus/Weapons/Sentients/OperatorAmplifiers/OperatorAmpWeapon",
                name: getAddDict("/Lotus/Language/Items/OperatorVoidBeam")
            });
            data.OperatorAmps.push({
                uniqueName:
                    "/Lotus/Weapons/Sentients/OperatorAmplifiers/SentTrainingAmplifier/OperatorTrainingAmpWeapon",
                name: getAddDict("/Lotus/Language/OstronCrafting/OperatorTrainingAmpName")
            });
            data.Melee.push({
                uniqueName: "/Lotus/Weapons/Ostron/Melee/LotusModularWeapon",
                name: getAddDict("/Lotus/Language/OstronCrafting/Zaw_Singular")
            });
            data.LongGuns.push({
                uniqueName: "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimary",
                name: getAddDict("/Lotus/Language/Weapons/LotusModularGunName")
            });
            data.Pistols.push({
                uniqueName: "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondary",
                name: getAddDict("/Lotus/Language/Weapons/LotusModularGunName")
            });
            data.MoaPets ??= [];
            data.MoaPets.push({
                uniqueName: "/Lotus/Types/Friendly/Pets/MoaPets/MoaPetPowerSuit",
                name: getAddDict("/Lotus/Language/SolarisVenus/MoaPet_Singular")
            });
            data.MoaPets.push({
                uniqueName: "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetPowerSuit",
                name: getAddDict("/Lotus/Language/Pets/ZanukaPetItemName")
            });

            data.miscitems.push(
                {
                    uniqueName: "/Lotus/Types/Recipes/CosmeticUnenhancerItem",
                    name: getAddDict("/Lotus/Language/Items/CosmeticUnenhancerName")
                },
                {
                    uniqueName: "/Lotus/Types/Items/Research/DojoColors/GenericDojoColorPigment",
                    name: normalizeText(
                        getAddDict("/Lotus/Language/Items/DojoColorPigment")
                            .replaceAll("|COLOUR_NAME|", "")
                            .replaceAll(" ", "")
                    )
                },
                {
                    uniqueName: "/Lotus/Types/Items/MiscItems/BossNavCode",
                    name: getAddDict("/Lotus/Language/Items/BossNavCode")
                },
                {
                    uniqueName: "/Lotus/Types/Items/MiscItems/Actuator",
                    name: getAddDict("/Lotus/Language/Items/Actuator")
                }
            );

            data.VarziaOffers.unshift({
                uniqueName: "",
                name: loc("disabled")
            });

            data.Boosters ??= [];
            data.Boosters.push({
                uniqueName: "/Lotus/Types/Boosters/ReviveBooster",
                name: getAddDict("/Lotus/Language/Items/ReviveBoosterName")
            });

            const itemMap = {
                "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetAPowerSuit": {
                    name: data.ModularParts.find(
                        i => i.uniqueName === "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/ZanukaPetPartHeadA"
                    ).name
                },
                "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetBPowerSuit": {
                    name: data.ModularParts.find(
                        i => i.uniqueName === "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/ZanukaPetPartHeadB"
                    ).name
                },
                "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetCPowerSuit": {
                    name: data.ModularParts.find(
                        i => i.uniqueName === "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/ZanukaPetPartHeadC"
                    ).name
                }
            };
            for (const [type, items] of Object.entries(data)) {
                if (type == "archonCrystalUpgrades") {
                    Object.entries(items).forEach(([uniqueName, name]) => {
                        const option = document.createElement("option");
                        option.setAttribute("data-key", uniqueName);
                        option.value = name;
                        document.getElementById("datalist-" + type).appendChild(option);
                    });
                } else if (type == "innateDamages") {
                    Object.entries(items).forEach(([uniqueName, name]) => {
                        const option = document.createElement("option");
                        option.value = uniqueName;
                        option.textContent = name;
                        document.getElementById("valenceBonus-innateDamage").appendChild(option);
                    });
                } else if (type == "VarziaOffers") {
                    const select = document.getElementById("worldState.varziaOverride");
                    items.forEach(item => {
                        const option = document.createElement("option");
                        option.value = item.uniqueName;
                        option.textContent = item.name;
                        select.appendChild(option);
                    });
                    select.value = rememberedVarziaOverride;
                } else if (type == "NightwaveTags") {
                    const select = document.getElementById("worldState.nightwaveOverride");
                    let oldNWIntermissionLeft = 3;
                    {
                        const nwDisabledOption = document.createElement("option");
                        nwDisabledOption.value = "";
                        nwDisabledOption.textContent = loc("disabled");
                        nwDisabledOption.setAttribute("data-loc", "disabled");
                        select.appendChild(nwDisabledOption);
                    }
                    items.forEach(item => {
                        const option = document.createElement("option");
                        option.value = item.uniqueName;
                        option.textContent = item.name;
                        if (
                            [
                                "RadioLegionIntermissionSyndicate",
                                "RadioLegionIntermission2Syndicate",
                                "RadioLegionIntermission3Syndicate"
                            ].includes(item.uniqueName)
                        ) {
                            option.textContent += ` ${"I".repeat(oldNWIntermissionLeft)}`;
                            oldNWIntermissionLeft--;
                        }
                        select.appendChild(option);
                    });
                    {
                        const nwDisableOption = document.createElement("option");
                        nwDisableOption.value = "disable";
                        nwDisableOption.textContent = loc("worldState_nightwaveOff");
                        nwDisableOption.setAttribute("data-loc", "worldState_nightwaveOff");
                        select.appendChild(nwDisableOption);
                    }
                    select.value = rememberedNWOverride;
                } else if (type == "Syndicates") {
                    items.forEach(item => {
                        if (["ConclaveSyndicate", "NightcapJournalSyndicate"].includes(item.uniqueName)) {
                            return;
                        }
                        if (item.uniqueName.startsWith("RadioLegion")) {
                            item.name += " (" + item.uniqueName + ")";
                        }
                        const option = document.createElement("option");
                        option.value = item.uniqueName;
                        option.textContent = item.name;
                        document.getElementById("changeSyndicate").appendChild(option);
                    });
                } else if (type == "FlavourItems") {
                    const cursorPrefixes = {
                        Controller: loc("code_controller"),
                        MouseGrey: loc("code_mouse"),
                        MouseLine: loc("code_mouseLine"),
                        Mouse: loc("code_mouse")
                    };
                    items.forEach(item => {
                        if (item.uniqueName.startsWith("/Lotus/Interface/Graphics/CustomUI/Cursors/")) {
                            let base = item.uniqueName.replace("/Lotus/Interface/Graphics/CustomUI/Cursors/", "");
                            for (const key in cursorPrefixes) {
                                if (base.startsWith(key)) {
                                    const prefix = cursorPrefixes[key];
                                    const suffix = base.slice(key.length);
                                    item.name = prefix + " " + suffix;
                                    break;
                                }
                            }
                        } else if (item.uniqueName.includes("ColourPicker")) {
                            item.name = getAddDict("/Lotus/Language/Store/ItemColorPalette").replaceAll(
                                "|ITEM|",
                                item.name
                            );
                        }
                        if (!item.alwaysAvailable) {
                            const option = document.createElement("option");
                            option.setAttribute("data-key", item.uniqueName);
                            option.value = item.name;
                            document.getElementById("datalist-" + type).appendChild(option);
                        }
                        itemMap[item.uniqueName] = { ...item, type };
                    });
                } else if (type == "WeaponSkins") {
                    let beardNumber = 1;
                    items.forEach(item => {
                        if (item.name == "") {
                            if (item.uniqueName.includes("/Beards/")) {
                                item.name = getAddDict(
                                    "/Lotus/Language/Operator/TennoCustomization_DrifterBeardName"
                                ).replaceAll("|INDEX|", beardNumber.toString().padStart(3, "0"));
                                beardNumber++;
                            } else {
                                item.name = item.uniqueName;
                            }
                        }
                        if (!item.alwaysAvailable) {
                            const option = document.createElement("option");
                            option.setAttribute("data-key", item.uniqueName);
                            option.value = item.name;
                            document.getElementById("datalist-" + type).appendChild(option);
                        }
                        itemMap[item.uniqueName] = { ...item, type };
                    });
                } else if (["MissionTypes", "Nodes", "AdditionalDict"].includes(type)) {
                    items.forEach(item => {
                        if (!itemMap[item.uniqueName]) {
                            itemMap[item.uniqueName] = { ...item, type };
                        }
                    });
                } else if (type != "blueprintAndItem") {
                    const nameToItems = {};
                    items.forEach(item => {
                        item.name = item.name.replace(/<.+>/g, "").trim();
                        if (item.name == "") {
                            //console.log(`changed ${item.uniqueName} name to path`);
                            item.name = item.uniqueName;
                        }
                        if (item.uniqueName == "/Lotus/Powersuits/Excalibur/DarkExcalibur") {
                            item.name = loc("code_darkExcalibur").replace(
                                "|ITEM|",
                                data.Suits.find(i => i.uniqueName === "/Lotus/Powersuits/Excalibur/ExcaliburPrime").name
                            );
                        }
                        if (
                            [
                                "/Lotus/Types/Recipes/KevinTestRecipe",
                                "/Lotus/Types/Recipes/IncendiaryRifleModBlueprint"
                            ].includes(item.uniqueName)
                        ) {
                            item.name = loc("code_updateSuffix").replace("|TYPE|", item.name).replace("|VALUE|", "5");
                        }
                        if ("badReason" in item) {
                            if (item.badReason == "starter") {
                                item.name = loc("code_starter")
                                    .replaceAll("|MOD|", item.name)
                                    .replaceAll("|FLAWED|", getAddDict("/Lotus/Language/Labels/DAMAGED"));
                            } else if (item.badReason == "frivolous") {
                                item.name += " " + loc("code_badItem");
                            } else if (item.badReason == "u5mod") {
                                if (item.fits.length > 1) {
                                    item.name = loc("code_U5Mod").replace("|TYPE|", item.name);
                                }
                                item.name = loc("code_updateSuffix")
                                    .replace("|TYPE|", item.name)
                                    .replace("|VALUE|", "5");
                            }
                        }
                        nameToItems[item.name] ??= [];
                        nameToItems[item.name].push(item);
                    });

                    items.forEach(item => {
                        if (type == "ModularParts") {
                            const supportedModularParts = [
                                "LWPT_HB_DECK",
                                "LWPT_HB_ENGINE",
                                "LWPT_HB_FRONT",
                                "LWPT_HB_JET",
                                "LWPT_AMP_OCULUS",
                                "LWPT_AMP_CORE",
                                "LWPT_AMP_BRACE",
                                "LWPT_BLADE",
                                "LWPT_HILT",
                                "LWPT_HILT_WEIGHT",
                                "LWPT_GUN_PRIMARY_HANDLE",
                                "LWPT_GUN_SECONDARY_HANDLE",
                                "LWPT_GUN_BARREL",
                                "LWPT_GUN_CLIP",
                                "LWPT_MOA_ENGINE",
                                "LWPT_MOA_PAYLOAD",
                                "LWPT_MOA_HEAD",
                                "LWPT_MOA_LEG",
                                "LWPT_ZANUKA_BODY",
                                "LWPT_ZANUKA_HEAD",
                                "LWPT_ZANUKA_LEG",
                                "LWPT_ZANUKA_TAIL",
                                "LWPT_CATBROW_ANTIGEN",
                                "LWPT_CATBROW_MUTAGEN",
                                "LWPT_KUBROW_ANTIGEN",
                                "LWPT_KUBROW_MUTAGEN"
                            ];
                            if (supportedModularParts.includes(item.partType)) {
                                const option = document.createElement("option");
                                option.setAttribute("data-key", item.uniqueName);
                                option.value = item.name;
                                document
                                    .getElementById("datalist-" + type + "-" + item.partType.slice(5))
                                    .appendChild(option);
                            }
                        } else if (item.badReason != "notraw" && item.badReason != "metadataPatch") {
                            let stringifier = itemToString;
                            if (nameToItems[item.name].length > 1) {
                                stringifier = itemToStringWithSubtype;
                                if (!areItemsUnambiguous(nameToItems[item.name], stringifier)) {
                                    stringifier = itemToStringWithUniqueName;
                                    if (!areItemsUnambiguous(nameToItems[item.name], stringifier)) {
                                        console.log(
                                            `Not adding ${item.uniqueName} to datalist for ${type} due to ambiguous display name: ${item.name}`
                                        );
                                        return;
                                    }
                                }
                            }
                            const option = document.createElement("option");
                            option.setAttribute("data-key", item.uniqueName);
                            option.value = stringifier(item);
                            document.getElementById("datalist-" + type).appendChild(option);
                            if (item.eligibleForVault) {
                                const vaultOption = option.cloneNode(true);
                                document.getElementById("datalist-VaultMiscItems").appendChild(vaultOption);
                            }
                            if (item.baseEvolutionWeapon) {
                                const vaultOption = option.cloneNode(true);
                                document.getElementById("datalist-EvolutionProgress").appendChild(vaultOption);
                            }
                        }
                        itemMap[item.uniqueName] = { ...item, type };
                    });
                }
            }
            resolve(itemMap);

            if (missingAdditionalDict.size) {
                console.warn("Missing in AdditionalDict:", [...missingAdditionalDict]);
            }
        });
    });
}
fetchItemList();

async function populateInventoryRoute() {
    const [data, itemMap] = await Promise.all([awaitAuthz().then(getInventoryData), window.itemListPromise]);

    document.getElementById("typeName-tab").classList.remove("active");
    document.getElementById("typeName-tab-content").classList.remove("active", "show");
    document.getElementById("typeName-type").value = "";

    document.getElementById("miscItems-tab").classList.add("active");
    document.getElementById("miscItems-tab-content").classList.add("active", "show");

    ["RegularCredits", "PremiumCredits", "FusionPoints", "PrimeTokens", "CrewShipFusionPoints"].forEach(currency => {
        document.getElementById(currency + "-owned").textContent = loc("currency_owned").replaceAll(
            "|COUNT|",
            data[currency].toLocaleString()
        );
    });

    [
        "Suits",
        "SpaceSuits",
        "Sentinels",
        "LongGuns",
        "Pistols",
        "Melee",
        "SpaceGuns",
        "SpaceMelee",
        "SentinelWeapons",
        "Hoverboards",
        "OperatorAmps",
        "MechSuits",
        "MoaPets",
        "KubrowPets"
    ].forEach(category => {
        document.getElementById(category + "-list").innerHTML = "";
        data[category]
            .sort((a, b) => (b.Favorite ? 1 : 0) - (a.Favorite ? 1 : 0))
            .forEach(item => {
                const tr = document.createElement("tr");
                tr.setAttribute("data-item-oid", item.ItemId.$oid);
                tr.setAttribute("data-item-type", item.ItemType);
                {
                    const td = document.createElement("td");
                    td.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
                    if (item.ItemName) {
                        const pipeIndex = item.ItemName.indexOf("|");
                        if (pipeIndex != -1) {
                            td.textContent = item.ItemName.substr(1 + pipeIndex) + " " + td.textContent;
                        } else {
                            td.textContent = item.ItemName + " (" + td.textContent + ")";
                        }
                    }
                    if (item.Details?.Name) {
                        td.textContent = item.Details.Name + " (" + td.textContent + ")";
                    }
                    if (item.ModularParts && item.ModularParts.length) {
                        td.textContent += " [";
                        item.ModularParts.forEach(part => {
                            td.textContent += " " + (itemMap[part]?.name ?? part) + ",";
                        });
                        td.textContent = td.textContent.slice(0, -1) + " ]";
                    }
                    if (itemMap[item.ItemType]?.badReason == "metadataPatch") {
                        td.textContent += " ";
                        const abbr = document.createElement("abbr");
                        abbr.innerHTML = icons.note;
                        abbr.title = loc("code_metadataPatchRequired");
                        td.appendChild(abbr);
                    }
                    tr.appendChild(td);
                }
                {
                    const td = document.createElement("td");
                    td.classList = "text-end text-nowrap";

                    let maxXP = Math.pow(itemMap[item.ItemType]?.maxLevelCap ?? 30, 2) * 1000;
                    if (
                        ![
                            "Suits",
                            "SpaceSuits",
                            "Hoverboards",
                            "MechSuits",
                            "Sentinels",
                            "MoaPets",
                            "KubrowPets"
                        ].includes(category)
                    ) {
                        maxXP /= 2;
                    }
                    let anyExaltedMissingXP = false;
                    if (item.XP >= maxXP && item.ItemType in itemMap && "exalted" in itemMap[item.ItemType]) {
                        for (const exaltedType of itemMap[item.ItemType].exalted) {
                            const exaltedItem = data.SpecialItems.find(x => x.ItemType == exaltedType);
                            if (exaltedItem) {
                                const exaltedCap = itemMap[exaltedType]?.type == "weapons" ? 800_000 : 1_600_000;
                                if (exaltedItem.XP < exaltedCap) {
                                    anyExaltedMissingXP = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (
                        itemMap[item.ItemType]?.maxLevelCap > 30 &&
                        (item.Polarized ?? 0) < (itemMap[item.ItemType].maxLevelCap - 30) / 2
                    ) {
                        const a = document.createElement("a");
                        a.href = "#";
                        a.onclick = function (event) {
                            event.preventDefault();
                            a.parentNode.removeChild(a);
                            unlockLevelCap(category, item.ItemId.$oid, (itemMap[item.ItemType].maxLevelCap - 30) / 2);
                        };
                        a.title = loc("code_unlockLevelCap");
                        a.setAttribute("aria-label", a.title);
                        a.innerHTML = '<i class="bi bi-mortarboard" aria-hidden="true"></i>';
                        td.appendChild(a);
                    }
                    if (item.XP < maxXP || anyExaltedMissingXP) {
                        const a = document.createElement("a");
                        a.href = "#";
                        a.onclick = function (event) {
                            event.preventDefault();
                            revalidateAuthz().then(async () => {
                                if (item.XP < maxXP) {
                                    await addGearExp(category, item.ItemId.$oid, maxXP - item.XP);
                                    if (item.AltWeaponModeId) {
                                        const otherCategory = category == "Melee" ? "LongGuns" : "Melee";
                                        await addGearExp(otherCategory, item.AltWeaponModeId.$oid, maxXP - item.XP);
                                    }
                                }
                                if ("exalted" in itemMap[item.ItemType]) {
                                    for (const exaltedType of itemMap[item.ItemType].exalted) {
                                        const exaltedItem = data.SpecialItems.find(x => x.ItemType == exaltedType);
                                        if (exaltedItem) {
                                            const exaltedCap =
                                                itemMap[exaltedType]?.type == "weapons" ? 800_000 : 1_600_000;
                                            if (exaltedItem.XP < exaltedCap) {
                                                await addGearExp(
                                                    "SpecialItems",
                                                    exaltedItem.ItemId.$oid,
                                                    exaltedCap - exaltedItem.XP
                                                );
                                            }
                                        }
                                    }
                                }
                                updateInventory();
                            });
                        };
                        a.title = loc("code_maxRank");
                        a.setAttribute("aria-label", a.title);
                        a.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
                        td.appendChild(a);
                    }

                    {
                        const a = document.createElement("a");
                        a.href = "/webui/details?productCategory=" + category + "&itemId=" + item.ItemId.$oid;
                        a.title = loc("inventory_openDetails");
                        a.setAttribute("aria-label", a.title);
                        a.innerHTML = '<i class="bi bi-pencil-square" aria-hidden="true"></i>';
                        td.appendChild(a);
                    }

                    if (!(item.Features & 8) && modularWeapons.includes(item.ItemType)) {
                        const a = document.createElement("a");
                        a.href = "#";
                        a.onclick = function (event) {
                            event.preventDefault();
                            equipmentFeatures(category, item.ItemId.$oid, 8);
                        };
                        a.title = loc("code_gild");
                        a.setAttribute("aria-label", a.title);
                        a.innerHTML = '<i class="bi bi-star" aria-hidden="true"></i>';
                        td.appendChild(a);
                    }
                    if (category == "KubrowPets") {
                        const a = document.createElement("a");
                        a.href = "#";
                        a.onclick = function (event) {
                            event.preventDefault();
                            maturePet(item.ItemId.$oid, !item.Details.IsPuppy);
                        };
                        if (item.Details.IsPuppy) {
                            a.title = loc("code_mature");
                            a.setAttribute("aria-label", a.title);
                            a.innerHTML = '<i class="bi bi-person-arms-up" aria-hidden="true"></i>';
                        } else {
                            a.title = loc("code_unmature");
                            a.setAttribute("aria-label", a.title);
                            a.innerHTML = '<i class="bi bi-person-walking" aria-hidden="true"></i>';
                        }
                        td.appendChild(a);
                    }
                    {
                        const a = document.createElement("a");
                        a.href = "#";
                        a.onclick = async function (event) {
                            event.preventDefault();
                            const name = await window.webuiComponents.prompt({
                                title: loc("code_rename"),
                                confirmLabel: loc("ui_save")
                            });
                            if (name !== null && name.trim()) {
                                renameGear(category, item.ItemId.$oid, name);
                            }
                        };
                        a.title = loc("code_rename");
                        a.setAttribute("aria-label", a.title);
                        a.innerHTML = '<i class="bi bi-tag" aria-hidden="true"></i>';
                        td.appendChild(a);
                    }
                    {
                        const a = document.createElement("a");
                        a.href = "#";
                        a.onclick = function (event) {
                            event.preventDefault();
                            tr.parentNode.removeChild(tr);
                            disposeOfGear(category, item.ItemId.$oid);
                            if (item.AltWeaponModeId) {
                                const otherCategory = category == "Melee" ? "LongGuns" : "Melee";
                                const otherTr = document.querySelector(
                                    `[data-item-oid="${item.AltWeaponModeId.$oid}"]`
                                );
                                if (otherTr) {
                                    otherTr.parentNode.removeChild(otherTr);
                                    disposeOfGear(otherCategory, item.AltWeaponModeId.$oid);
                                }
                            }
                        };
                        a.title = loc("code_remove");
                        a.setAttribute("aria-label", a.title);
                        a.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
                        td.appendChild(a);
                    }
                    tr.appendChild(td);
                }
                document.getElementById(category + "-list").appendChild(tr);
            });
    });

    document.getElementById("EvolutionProgress-list").innerHTML = "";
    data.EvolutionProgress?.forEach(item => {
        const maxRank = itemMap[item.ItemType]?.permanentEvolutionWeapon ? 5 : 4;
        const tr = document.createElement("tr");
        tr.setAttribute("data-item-type", item.ItemType);
        {
            const td = document.createElement("td");
            td.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
            if (item.Rank != null) {
                td.textContent += " | " + loc("code_rank") + ": [" + item.Rank + "/" + maxRank + "]";
            }
            tr.appendChild(td);
        }
        {
            const td = document.createElement("td");
            td.classList = "text-end text-nowrap";
            if (item.Rank < maxRank) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    setEvolutionProgress([{ ItemType: item.ItemType, Rank: maxRank }]);
                };
                a.title = loc("code_maxRank");
                a.innerHTML = icons.arrowUp;

                td.appendChild(a);
            }
            if (item.Rank < maxRank) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    setEvolutionProgress([{ ItemType: item.ItemType, Rank: item.Rank + 1 }]);
                };
                a.title = loc("code_rankUp");
                a.innerHTML = icons.angleUp;

                td.appendChild(a);
            }
            if ((itemMap[item.ItemType]?.permanentEvolutionWeapon && item.Rank > 0) || item.Rank > 1) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    setEvolutionProgress([{ ItemType: item.ItemType, Rank: item.Rank - 1 }]);
                };
                a.title = loc("code_rankDown");
                a.innerHTML = icons.angleDown;

                td.appendChild(a);
            }
            {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    setEvolutionProgress([{ ItemType: item.ItemType, Delete: true }]);
                };
                a.title = loc("code_remove");
                a.innerHTML = icons.trash;

                td.appendChild(a);
            }

            tr.appendChild(td);
        }

        document.getElementById("EvolutionProgress-list").appendChild(tr);
    });

    document.getElementById("Boosters-list").innerHTML = "";
    data.Boosters.forEach(item => {
        if (item.ExpiryDate < Math.floor(Date.now() / 1000)) {
            // Booster has expired, skip it
            return;
        }
        const tr = document.createElement("tr");
        {
            const td = document.createElement("td");
            td.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
            tr.appendChild(td);
            if (item.ItemType == "/Lotus/Types/Boosters/ReviveBooster") {
                td.textContent += " ";
                const abbr = document.createElement("abbr");
                abbr.innerHTML = icons.note;
                abbr.title = loc("code_reviveBoosterDesc");
                td.appendChild(abbr);
            }
        }
        {
            const td = document.createElement("td");
            td.classList = "text-end text-nowrap";
            {
                const form = document.createElement("form");
                form.style.display = "inline-block";
                form.onsubmit = function (event) {
                    event.preventDefault();
                    const maxDate = new Date(input.max);
                    const selectedDate = new Date(input.value);
                    if (selectedDate > maxDate) {
                        input.value = maxDate.toISOString().slice(0, 16);
                    }
                    doChangeBoosterExpiry(item.ItemType, input);
                };

                const input = document.createElement("input");
                input.type = "datetime-local";
                input.classList = "form-control form-control-sm";
                input.value = formatDatetime("%Y-%m-%d %H:%M:%s", item.ExpiryDate * 1000);
                input.max = "2038-01-19T03:14";
                input.onblur = function () {
                    const maxDate = new Date(input.max);
                    const selectedDate = new Date(input.value);
                    if (selectedDate > maxDate) {
                        input.value = maxDate.toISOString().slice(0, 16);
                    }
                    doChangeBoosterExpiry(item.ItemType, input);
                };

                form.appendChild(input);
                td.appendChild(form);
            }
            {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    setBooster(item.ItemType, 0);
                };
                a.title = loc("code_remove");
                a.innerHTML = icons.trash;
                td.appendChild(a);
            }
            tr.appendChild(td);
        }
        document.getElementById("Boosters-list").appendChild(tr);
    });

    document.getElementById("FlavourItems-list").innerHTML = "";
    data.FlavourItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-item-type", item.ItemType);
        {
            const td = document.createElement("td");
            td.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
            tr.appendChild(td);
        }
        {
            const td = document.createElement("td");
            td.classList = "text-end text-nowrap";

            {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    tr.parentNode.removeChild(tr);
                    removeCustomization(item.ItemType);
                };
                a.title = loc("code_remove");
                a.innerHTML = icons.trash;
                td.appendChild(a);
            }
            tr.appendChild(td);
        }

        document.getElementById("FlavourItems-list").appendChild(tr);
    });

    document.getElementById("WeaponSkins-list").innerHTML = "";
    data.WeaponSkins.forEach(item => {
        if (item.ItemId.$oid.startsWith("ca70ca70ca70ca70")) return;
        const tr = document.createElement("tr");
        {
            const td = document.createElement("td");
            const name = itemMap[item.ItemType]?.name?.trim();
            td.textContent = name || item.ItemType;
            tr.appendChild(td);
        }
        {
            const td = document.createElement("td");
            td.classList = "text-end text-nowrap";
            {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    document.getElementById("WeaponSkins-list").removeChild(tr);
                    disposeOfGear("WeaponSkins", item.ItemId.$oid);
                };
                a.title = loc("code_remove");
                a.innerHTML = icons.trash;
                td.appendChild(a);
            }

            tr.appendChild(td);
        }

        document.getElementById("WeaponSkins-list").appendChild(tr);
    });

    if (data.CrewShipHarnesses?.length) {
        window.plexus = {
            id: data.CrewShipHarnesses[0].ItemId.$oid,
            xp: data.CrewShipHarnesses[0].XP
        };
    }

    document.getElementById("ShipDecorations-list").innerHTML = "";
    data.ShipDecorations.forEach(item => {
        if (item.ItemCount > 0) {
            const tr = document.createElement("tr");
            tr.setAttribute("data-item-type", item.ItemType);
            {
                const td = document.createElement("td");
                td.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
                if (item.ItemCount > 1) {
                    td.innerHTML +=
                        " <span title='" + loc("code_count") + "'>🗍 " + parseInt(item.ItemCount) + "</span>";
                }
                tr.appendChild(td);
            }
            {
                const td = document.createElement("td");
                td.classList = "text-end text-nowrap";
                {
                    const a = document.createElement("a");
                    a.href = "#";
                    a.onclick = function (event) {
                        event.preventDefault();
                        tr.parentNode.removeChild(tr);
                        removeShipDecoration(item.ItemType, item.ItemCount);
                    };
                    a.title = loc("code_remove");
                    a.innerHTML = icons.trash;
                    td.appendChild(a);
                }
                tr.appendChild(td);
            }
            document.getElementById("ShipDecorations-list").appendChild(tr);
        }
    });

    document.getElementById("QuestKeys-list").innerHTML = "";
    data.QuestKeys.forEach(item => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-item-type", item.ItemType);
        const run = item.Progress[0]?.c ?? 0;
        const stage = run == 0 ? item.Progress.length : item.Progress.map(p => p.c ?? 0).lastIndexOf(run);

        {
            const td = document.createElement("td");
            td.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
            if (!item.Completed) {
                td.textContent +=
                    " | " + loc("code_stage") + ": [" + stage + "/" + itemMap[item.ItemType]?.chainLength + "]";
            } else {
                td.textContent += " | " + loc("code_completed");
            }

            if (run > 0) {
                td.textContent += " | " + loc("code_replays") + ": " + (run + 1);
            }

            if (data.ActiveQuest == item.ItemType) td.textContent += " | " + loc("code_active");
            tr.appendChild(td);
        }
        {
            const td = document.createElement("td");
            td.classList = "text-end text-nowrap";
            if (data.ActiveQuest == item.ItemType && !item.Completed) {
                console.log(data.ActiveQuest);

                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    debounce(doQuestUpdate, "setInactive", item.ItemType);
                };
                a.title = loc("code_setInactive");
                a.innerHTML = icons.circleStop;
                td.appendChild(a);
            }
            if (stage > 0) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    debounce(doQuestUpdate, "resetKey", item.ItemType);
                };
                a.title = loc("code_reset");
                a.innerHTML = icons.arrowRotateRight;
                td.appendChild(a);
            }
            if (itemMap[item.ItemType]?.chainLength > stage && !item.Completed) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    debounce(doQuestUpdate, "completeKey", item.ItemType);
                };
                a.title = loc("code_complete");
                a.innerHTML = icons.check;
                td.appendChild(a);
            }
            if (stage > 0 && itemMap[item.ItemType]?.chainLength > 1) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    debounce(doQuestUpdate, "prevStage", item.ItemType);
                };
                a.title = loc("code_prevStage");
                a.innerHTML = icons.angleLeft;
                td.appendChild(a);
            }
            if (
                itemMap[item.ItemType]?.chainLength > stage &&
                !item.Completed &&
                itemMap[item.ItemType]?.chainLength > 1
            ) {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    debounce(doQuestUpdate, "nextStage", item.ItemType);
                };
                a.title = loc("code_nextStage");
                a.innerHTML = icons.angleRight;
                td.appendChild(a);
            }
            {
                const a = document.createElement("a");
                a.href = "#";
                a.onclick = function (event) {
                    event.preventDefault();
                    debounce(doQuestUpdate, "deleteKey", item.ItemType);
                };
                a.title = loc("code_remove");
                a.innerHTML = icons.trash;
                td.appendChild(a);
            }
            tr.appendChild(td);
        }
        document.getElementById("QuestKeys-list").appendChild(tr);
    });
}
single.getRoute("/webui/inventory").on("beforeload", populateInventoryRoute);

function updateGuild() {
    window.guild_data = null;
    window.guildPage?.reset();
    if (single.getCurrentPath() == "/webui/clan") {
        single.loadRoute(single.getCurrentPath());
    }
}

function dispatchAddItemsRequestsBatch(requests) {
    return new Promise(resolve => {
        revalidateAuthz().then(() => {
            const req = $.post({
                url: "/custom/addItems?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify(requests)
            });
            req.done(() => {
                updateInventory();
                resolve();
            });
        });
    });
}

async function addMissingEquipment(categories) {
    const requests = [];
    categories.forEach(category => {
        document.querySelectorAll("#datalist-" + category + " option").forEach(elm => {
            if (
                !document.querySelector(
                    "#" + category + "-list [data-item-type='" + elm.getAttribute("data-key") + "']"
                )
            ) {
                if (!webUiModularWeapons.includes(elm.getAttribute("data-key"))) {
                    let ItemCount = 1;
                    if (category == "ShipDecorations") ItemCount = 999999;
                    requests.push({ ItemType: elm.getAttribute("data-key"), ItemCount });
                }
            }
        });
    });
    if (
        requests.length != 0 &&
        (await window.webuiComponents.confirm({
            title: loc("inventory_bulkAdd"),
            message: replacePluralForms(loc("code_addItemsConfirm"), { COUNT: requests.length }),
            variant: "primary",
            icon: "bi-plus-circle"
        }))
    ) {
        return dispatchAddItemsRequestsBatch(requests);
    }
}

function addMissingEvolutionProgress() {
    window.itemListPromise.then(async itemMap => {
        const requests = [];
        document.querySelectorAll("#datalist-EvolutionProgress option").forEach(elm => {
            const uniqueName = elm.getAttribute("data-key");
            if (!document.querySelector("#EvolutionProgress-list [data-item-type='" + uniqueName + "']")) {
                requests.push({ ItemType: uniqueName, Rank: itemMap[uniqueName]?.permanentEvolutionWeapon ? 0 : 1 });
            }
        });
        if (requests.length == 0) {
            toast(loc("code_nothingToDo"));
        } else if (
            await window.webuiComponents.confirm({
                title: loc("inventory_bulkAdd"),
                message: replacePluralForms(loc("code_addItemsConfirm"), { COUNT: requests.length }),
                variant: "primary",
                icon: "bi-plus-circle"
            })
        ) {
            setEvolutionProgress(requests);
        }
    });
}

function maxRankAllEvolutions() {
    revalidateAuthz().then(() => {
        getInventoryData().then(data => {
            window.itemListPromise.then(async itemMap => {
                const requests = [];

                data.EvolutionProgress.forEach(item => {
                    const maxRank = itemMap[item.ItemType]?.permanentEvolutionWeapon ? 5 : 4;
                    if (item.Rank < maxRank) {
                        requests.push({
                            ItemType: item.ItemType,
                            Rank: maxRank
                        });
                    }
                });

                if (Object.keys(requests).length > 0) {
                    return setEvolutionProgress(requests).then(() => {
                        toast(loc("code_succRankUp"));
                    });
                }

                toast(loc("code_noEquipmentToRankUp"));
            });
        });
    });
}

function maxRankAllEquipment(categories) {
    revalidateAuthz().then(() => {
        getInventoryData().then(data => {
            window.itemListPromise.then(itemMap => {
                const batchData = {};

                categories.forEach(category => {
                    data[category].forEach(item => {
                        const maxXP = [
                            "Suits",
                            "SpaceSuits",
                            "Sentinels",
                            "Hoverboards",
                            "MechSuits",
                            "MoaPets",
                            "KubrowPets"
                        ].includes(category)
                            ? 1_600_000
                            : 800_000;

                        if (item.XP < maxXP) {
                            if (!batchData[category]) {
                                batchData[category] = [];
                            }
                            batchData[category].push({
                                ItemId: { $oid: item.ItemId.$oid },
                                XP: maxXP
                            });
                        }
                        if (item.ItemType in itemMap && "exalted" in itemMap[item.ItemType]) {
                            for (const exaltedType of itemMap[item.ItemType].exalted) {
                                const exaltedItem = data["SpecialItems"].find(x => x.ItemType == exaltedType);
                                if (exaltedItem) {
                                    const exaltedCap = itemMap[exaltedType]?.type == "weapons" ? 800_000 : 1_600_000;
                                    if (exaltedItem.XP < exaltedCap) {
                                        batchData["SpecialItems"] ??= [];
                                        batchData["SpecialItems"].push({
                                            ItemId: { $oid: exaltedItem.ItemId.$oid },
                                            XP: exaltedCap
                                        });
                                    }
                                }
                            }
                        }
                    });
                });

                if (Object.keys(batchData).length > 0) {
                    return sendBatchGearExp(batchData);
                }

                toast(loc("code_noEquipmentToRankUp"));
            });
        });
    });
}

// Assumes that caller revalidates authz
function addGearExp(category, oid, xp) {
    const data = {};
    data[category] = [
        {
            ItemId: { $oid: oid },
            XP: xp
        }
    ];
    return new Promise((resolve, reject) => {
        $.post({
            url: "/custom/addXp?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(data)
        })
            .done(resolve)
            .fail(reject);
    });
}

function sendBatchGearExp(data) {
    revalidateAuthz().then(() => {
        $.post({
            url: "/custom/addXp?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(data)
        }).done(() => {
            toast(loc("code_succRankUp"));
            updateInventory();
        });
    });
}

function renameGear(category, oid, name) {
    revalidateAuthz().then(() => {
        if (category == "KubrowPets") {
            $.post({
                url: "/api/renamePet.php?" + window.authz + "&webui=1",
                contentType: "text/plain",
                data: JSON.stringify({
                    petId: oid,
                    name: name
                })
            }).done(function () {
                inventory_data.KubrowPets.find(x => x.ItemId.$oid == oid).Details.Name = name;
                populateInventoryRoute();
            });
        } else {
            $.post({
                url: "/api/nameWeapon.php?" + window.authz + "&Category=" + category + "&ItemId=" + oid + "&webui=1",
                contentType: "text/plain",
                data: JSON.stringify({
                    ItemName: name
                })
            }).done(function () {
                inventory_data[category].find(x => x.ItemId.$oid == oid).ItemName = name;
                populateInventoryRoute();
            });
        }
    });
}

function disposeOfGear(category, oid) {
    if (category == "KubrowPets") {
        revalidateAuthz().then(() => {
            $.post({
                url: "/api/releasePet.php?" + window.authz,
                contentType: "application/octet-stream",
                data: JSON.stringify({
                    Recipe: "webui",
                    petId: oid
                })
            }).done(function () {
                inventory_data = undefined; // UI is up-to-date now, but subsequent updates will need to grab new data
            });
        });
    } else {
        const data = {
            SellCurrency: "SC_RegularCredits",
            SellPrice: 0,
            Items: {}
        };
        data.Items[category] = [
            {
                String: oid,
                Count: 0
            }
        ];
        revalidateAuthz().then(() => {
            $.post({
                url: "/api/sell.php?" + window.authz,
                contentType: "text/plain",
                data: JSON.stringify(data)
            }).done(function () {
                inventory_data = undefined; // UI is up-to-date now, but subsequent updates will need to grab new data
            });
        });
    }
}

function disposeOfItems(category, type, count) {
    const data = {
        SellCurrency: "SC_RegularCredits",
        SellPrice: 0,
        Items: {}
    };
    data.Items[category] = [
        {
            String: type,
            Count: count
        }
    ];
    revalidateAuthz().then(() => {
        $.post({
            url: "/api/sell.php?" + window.authz,
            contentType: "text/plain",
            data: JSON.stringify(data)
        }).done(function () {
            inventory_data = undefined; // UI is up-to-date now, but subsequent updates will need to grab new data
        });
    });
}

function equipmentFeatures(category, oid, bit) {
    revalidateAuthz().then(() => {
        $.get(
            "/custom/equipmentFeatures?" + window.authz + "&ItemId=" + oid + "&Category=" + category + "&bit=" + bit
        ).done(function () {
            inventory_data[category].find(x => x.ItemId.$oid == oid).Features ^= bit;
            // toggle state was already updated when the user clicked on it
        });
    });
}

function unlockLevelCap(category, oid, formas) {
    revalidateAuthz().then(() => {
        $.post({
            url: "/custom/unlockLevelCap?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({
                Category: category,
                ItemId: oid,
                Polarized: formas
            })
        }).done(function () {
            inventory_data[category].find(x => x.ItemId.$oid == oid).Polarized = formas;
        });
    });
}

function maturePet(oid, revert) {
    revalidateAuthz().then(() => {
        $.post({
            url: "/api/maturePet.php?" + window.authz,
            contentType: "application/octet-stream",
            data: JSON.stringify({
                petId: oid,
                revert
            })
        }).done(function () {
            inventory_data.KubrowPets.find(x => x.ItemId.$oid == oid).Details.IsPuppy = revert;
            populateInventoryRoute();
        });
    });
}

function setEvolutionProgress(requests) {
    return new Promise(resolve => {
        revalidateAuthz().then(() => {
            const req = $.post({
                url: "/custom/setEvolutionProgress?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify(requests)
            });
            req.done(newEvolutionProgress => {
                inventory_data.EvolutionProgress = newEvolutionProgress;
                populateInventoryRoute();
                resolve();
            });
        });
    });
}

function doAcquireCountItems(category) {
    const uniqueName = getKey(document.getElementById("acquire-type-" + category));
    if (!uniqueName) {
        $(`#acquire-type-${category}`).addClass("is-invalid").focus();
        return;
    }
    const count = parseInt($(`#${category}-count`).val());
    if (count != 0 && !Number.isNaN(count)) {
        revalidateAuthz().then(() => {
            $.post({
                url: "/custom/addItems?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify([
                    {
                        ItemType: uniqueName,
                        ItemCount: count
                    }
                ])
            })
                .done(function (modifiedPaths) {
                    if (modifiedPaths.length) {
                        if (count > 0) {
                            toast(loc("code_succAdded"));
                        } else {
                            toast(loc("code_succRemoved"));
                        }
                    } else {
                        toast(loc("code_nothingToDo"));
                    }
                    if (category != "miscitems") updateInventory();
                })
                .fail(r => {
                    toast(r.responseText);
                });
        });
    }
}

function removeShipDecoration(uniqueName, count) {
    revalidateAuthz().then(() => {
        $.post({
            url: "/custom/addItems?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify([
                {
                    ItemType: uniqueName,
                    ItemCount: count * -1
                }
            ])
        }).done(function () {
            inventory_data.ShipDecorations.splice(
                inventory_data.ShipDecorations.findIndex(x => x.ItemType == uniqueName),
                1
            );
            toast(loc("code_succRemoved"));
        });
    });
}

function addItemByItemType() {
    const ItemType = document.getElementById("typeName-type").value;
    const ItemCount = parseInt($(`#typeName-count`).val());
    if (ItemCount != 0 && !Number.isNaN(ItemCount)) {
        revalidateAuthz().then(() => {
            $.post({
                url: "/custom/addItems?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify([
                    {
                        ItemType,
                        ItemCount
                    }
                ])
            })
                .done(function (modifiedPaths) {
                    if (modifiedPaths.length) {
                        if (ItemCount > 0) {
                            toast(loc("code_succAdded"));
                        } else {
                            toast(loc("code_succRemoved"));
                        }
                        if (modifiedPaths.some(x => !x.startsWith("MiscItems"))) {
                            updateInventory();
                        }
                    } else {
                        toast(loc("code_nothingToDo"));
                    }
                })
                .fail(r => {
                    toast(r.responseText);
                });
        });
    }
}

function toast(text, type = "primary") {
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-${type} border-0`;
    const div = document.createElement("div");
    div.className = "d-flex";
    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = text;
    div.appendChild(body);
    const button = document.createElement("button");
    button.className = "btn-close btn-close-white me-2 m-auto";
    button.setAttribute("data-bs-dismiss", "toast");
    div.appendChild(button);
    toast.appendChild(div);
    new bootstrap.Toast(document.querySelector(".toast-container").appendChild(toast)).show();
}

function formatAdminDate(value) {
    if (!value) return loc("admin_never");
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

const calls_in_flight = new Set();

async function debounce(func, ...args) {
    if (!func.name) {
        throw new Error(`cannot debounce anonymous functions`);
    }
    const callid = JSON.stringify({ func: func.name, args });
    if (!calls_in_flight.has(callid)) {
        calls_in_flight.add(callid);
        await func(...args);
        calls_in_flight.delete(callid);
    } else {
        console.log("debouncing", callid);
    }
}

document.querySelectorAll(".tags-input").forEach(input => {
    const datalist = document.getElementById(input.getAttribute("list"));
    let shadowDatalist;
    const optionsAreUnique = input.classList.contains("tags-input-unique");
    input.oninput = function () {
        const options = [...datalist.querySelectorAll("option")].map(x => x.textContent);

        if (!shadowDatalist) {
            shadowDatalist = document.createElement("datalist");
            shadowDatalist.setAttribute("id", "shadow-" + datalist.id);
            input.setAttribute("list", "shadow-" + datalist.id);
            shadowDatalist = document.documentElement.appendChild(shadowDatalist);
        }

        const value = [];
        for (const tag of this.value.split(",")) {
            const index = options.map(x => x.toLowerCase()).indexOf(tag.trim().toLowerCase());
            if (index != -1) {
                value.push(options[index]);
            }
        }

        this.setAttribute("data-tags-value", value.join(", "));

        if (value[0] == "all") {
            shadowDatalist.innerHTML = "<option>all</option>";
        } else {
            shadowDatalist.innerHTML = "";
            for (const option of options) {
                if (!optionsAreUnique || value.indexOf(option) == -1) {
                    const elm = document.createElement("option");
                    if (option == "all") {
                        elm.textContent = "all";
                    } else {
                        elm.textContent = [...value, option, ""].join(", ");
                    }
                    shadowDatalist.appendChild(elm);
                }
            }
        }
    };
    input.oninput();
});

document.querySelectorAll("#sidebar .sidebar-route-link").forEach(function (elm) {
    elm.addEventListener("click", function () {
        window.scrollTo(0, 0);
    });
});

async function removeItems(category) {
    revalidateAuthz().then(async () => {
        const count = document.getElementById(category + "-list").getElementsByTagName("tr").length;
        let message = replacePluralForms(loc("code_bulkRemoveConfirm"), {
            COUNT: count
        });
        if (category === "Suits") message += "\n" + loc("code_bulkRemoveNote");
        if (
            count != 0 &&
            (await window.webuiComponents.confirm({
                title: loc("inventory_bulkRemove"),
                message,
                variant: "danger",
                icon: "bi-trash3"
            }))
        ) {
            $.get("/custom/removeItems?" + window.authz + "&category=" + category).done(function () {
                updateInventory();
            });
        }
    });
}

function normalizeText(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function toTitleCase(srt) {
    return srt
        .replace(/[_-]+/g, " ")
        .trim()
        .toLocaleLowerCase()
        .replace(/(^|[\s])\p{L}/gu, match => match.toLocaleUpperCase());
}
