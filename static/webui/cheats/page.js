const globalAccountCheats = document.getElementById("global-account-cheats");
const serverCheatsConfig = document.getElementById("server-cheats-config");
if (globalAccountCheats && serverCheatsConfig) {
    serverCheatsConfig.prepend(globalAccountCheats);
}

document.querySelectorAll("#global-account-cheats input[id]").forEach(elm => {
    elm.dataset.configId = `accountCheats.${elm.id}`;
});

single.getRoute("/webui/cheats").on("beforeload", async function () {
    await awaitAuthz();
    const [data, config] = await Promise.all([getInventoryData(), getServerConfig()]);
    document.getElementById("changeSyndicate").value = data.SupportedSyndicate ?? "";
    applyServerConfig(config);
});

function doUnlockAllFocusSchools() {
    revalidateAuthz().then(() => {
        getInventoryData().then(async data => {
            const missingFocusUpgrades = {
                "/Lotus/Upgrades/Focus/Attack/AttackFocusAbility": true,
                "/Lotus/Upgrades/Focus/Tactic/TacticFocusAbility": true,
                "/Lotus/Upgrades/Focus/Ward/WardFocusAbility": true,
                "/Lotus/Upgrades/Focus/Defense/DefenseFocusAbility": true,
                "/Lotus/Upgrades/Focus/Power/PowerFocusAbility": true
            };
            if (data.FocusUpgrades) {
                for (const focusUpgrade of data.FocusUpgrades) {
                    if (focusUpgrade.ItemType in missingFocusUpgrades)
                        delete missingFocusUpgrades[focusUpgrade.ItemType];
                }
            }
            for (const upgradeType of Object.keys(missingFocusUpgrades)) {
                await unlockFocusSchool(upgradeType);
            }
            if (Object.keys(missingFocusUpgrades).length == 0) {
                toast(loc("code_focusAllUnlocked"));
            } else {
                toast(
                    replacePluralForms(loc("code_focusUnlocked"), {
                        COUNT: Object.keys(missingFocusUpgrades).length
                    })
                );
                if (ws_is_open) window.ws.send(JSON.stringify({ sync_inventory: true }));
            }
        });
    });
}

function unlockFocusSchool(upgradeType) {
    return new Promise(resolve => {
        // Deselect current FocusAbility so we will be able to unlock the way for free
        $.post({
            url: "/api/focus.php?" + window.authz + "&op=ActivateWay",
            contentType: "text/plain",
            data: JSON.stringify({ FocusType: null })
        }).done(function () {
            // Unlock the way now
            $.post({
                url: "/api/focus.php?" + window.authz + "&op=UnlockWay",
                contentType: "text/plain",
                data: JSON.stringify({ FocusType: upgradeType })
            }).done(() => resolve());
        });
    });
}

function doHelminthUnlockAll() {
    revalidateAuthz().then(() => {
        $.post("/api/infestedFoundry.php?" + window.authz + "&mode=custom_unlockall");
    });
}

function doIntrinsicsUnlockAll() {
    revalidateAuthz().then(() => {
        $.get("/custom/unlockAllIntrinsics?" + window.authz);
    });
}

document.querySelectorAll("#global-account-cheats input[type=checkbox]").forEach(elm => {
    elm.onchange = function () {
        revalidateAuthz().then(() => {
            const value = elm.checked;
            $.post({
                url: "/custom/setConfig?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify({ [elm.dataset.configId]: value })
            }).done(() => {
                elm.checked = value;
                if (config_data) config_data[elm.dataset.configId] = value;
            });
        });
    };
});

document.querySelectorAll("#global-account-cheats .input-group").forEach(grp => {
    const input = grp.querySelector("input");
    const select = grp.querySelector("select");
    const btn = grp.querySelector("button");
    if (input) {
        input.oninput = input.onchange = function () {
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary");
        };
    }
    if (select) {
        select.oninput = select.onchange = function () {
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary");
        };
    }
    btn.onclick = function () {
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-secondary");
        const input = btn.closest(".input-group").querySelector('input[type="number"]');
        if (!input) return;
        revalidateAuthz().then(() => {
            const value = Math.min(Number(input.value), Number(input.max));
            const configId = input.dataset.configId;
            $.post({
                url: "/custom/setConfig?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify({ [configId]: value })
            }).done(() => {
                input.value = value;
                if (config_data) config_data[configId] = value;
            });
        });
    };
});

async function doMaxPlexus() {
    if ((window.plexus?.xp ?? 0) < 900_000) {
        await addGearExp("CrewShipHarnesses", window.plexus.id, 900_000 - window.plexus.xp);
        window.plexus.xp = 900_000;
        toast(loc("code_succRankUp"));
    } else {
        toast(loc("code_noEquipmentToRankUp"));
    }
}

async function doUnlockAllScans() {
    await revalidateAuthz();
    await fetch("/custom/unlockAllScans?" + window.authz);
    toast(loc("cheats_unlockSuccRelog"));
}

async function doUnlockAllShipFeatures() {
    await revalidateAuthz();
    await fetch("/custom/unlockAllShipFeatures?" + window.authz);
    toast(loc(window.have_game_ws ? "code_succAdded" : "cheats_unlockSuccInventory"));
}

async function doUnlockAllCapturaScenes() {
    await revalidateAuthz();
    await fetch("/custom/unlockAllCapturaScenes?" + window.authz);
    toast(loc(window.have_game_ws ? "code_succAdded" : "cheats_unlockSuccInventory"));
}

async function unlockAllMissions() {
    await revalidateAuthz();
    await fetch("/custom/completeAllMissions?" + window.authz);
    toast(loc("cheats_unlockAllMissions_ok"));
}

async function unlockAllNormalMissions() {
    await revalidateAuthz();
    await fetch("/custom/completeAllMissions?" + window.authz + "&normalOnly=1");
    toast(loc("cheats_unlockAllMissions_ok"));
}

async function unlockAllJobChainBounties() {
    await revalidateAuthz();
    await fetch("/custom/unlockAllJobChainBounties?" + window.authz);
    toast(loc(window.have_game_ws ? "code_succAdded" : "cheats_unlockSuccInventory"));
}

async function unlockAllSimarisResearchEntries() {
    await revalidateAuthz();
    await fetch("/custom/unlockAllSimarisResearchEntries?" + window.authz);
    toast(loc(window.have_game_ws ? "code_succAdded" : "cheats_unlockSuccInventory"));
}

async function addMissingDangerRooms() {
    await revalidateAuthz();
    const data = await getInventoryData();
    const itemMap = await window.itemListPromise;
    const allItemKeys = Object.entries(itemMap)
        .filter(([_key, item]) => item.parentName === "/Lotus/Types/Items/DangerRoom/DangerRoomTile")
        .map(([key]) => key);
    allItemKeys.push("/Lotus/Types/Items/MiscItems/DangerRoomKey"); // also give access to the simulacrum itself
    const existingItems = new Set(data.MiscItems.filter(item => item.ItemCount > 0).map(item => item.ItemType));
    const requests = allItemKeys
        .filter(item => !existingItems.has(item))
        .map(ItemType => ({ ItemType, ItemCount: 1 }));

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
        await dispatchAddItemsRequestsBatch(requests);
    }
}

async function addMissingHelminthRecipes() {
    await revalidateAuthz();
    await fetch("/custom/addMissingHelminthBlueprints?" + window.authz);
}

async function doChangeSupportedSyndicate() {
    const uniqueName = document.getElementById("changeSyndicate").value;
    await revalidateAuthz();
    await $.get("/api/setSupportedSyndicate.php?" + window.authz + "&syndicate=" + uniqueName);
    inventory_data.SupportedSyndicate = uniqueName;
}

async function markAllAsRead() {
    await revalidateAuthz();
    const { Inbox } = await fetch("/api/inbox.php?" + window.authz).then(x => x.json());
    let any = false;
    for (const msg of Inbox) {
        if (!msg.r) {
            await fetch("/api/inbox.php?" + window.authz + "&messageId=" + msg.messageId.$oid);
            any = true;
        }
    }
    toast(loc(any ? "code_succRelog" : "code_nothingToDo"));
}
