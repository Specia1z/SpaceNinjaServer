function doAddAllMods() {
    let modsAll = new Set();
    for (const child of document.getElementById("datalist-mods").children) {
        modsAll.add(child.getAttribute("data-key"));
    }

    revalidateAuthz().then(() => {
        getInventoryData().then(data => {
            window.itemListPromise.then(async itemMap => {
                [
                    "/Lotus/Upgrades/Mods/Fusers/CommonModFuser",
                    "/Lotus/Upgrades/Mods/Fusers/UncommonModFuser",
                    "/Lotus/Upgrades/Mods/Fusers/RareModFuser",
                    "/Lotus/Upgrades/Mods/Fusers/LegendaryModFuser"
                ].forEach(path => modsAll.delete(path));

                for (const mod of modsAll) {
                    if (itemMap[mod]?.badReason == "u5mod") {
                        modsAll.delete(mod);
                    }
                }

                for (const modOwned of data.RawUpgrades) {
                    if ((modOwned.ItemCount ?? 1) > 0) {
                        modsAll.delete(modOwned.ItemType);
                    }
                }

                modsAll = Array.from(modsAll);
                if (
                    modsAll.length != 0 &&
                    (await window.webuiComponents.confirm({
                        title: loc("inventory_bulkAdd"),
                        message: replacePluralForms(loc("code_addModsConfirm"), { COUNT: modsAll.length }),
                        variant: "primary",
                        icon: "bi-plus-circle"
                    }))
                ) {
                    $.post({
                        url: "/custom/addItems?" + window.authz,
                        contentType: "application/json",
                        data: JSON.stringify(
                            modsAll.map(mod => {
                                const fusionLimit = itemMap[mod]?.fusionLimit ?? 0;
                                const isArcane = mod.startsWith("/Lotus/Upgrades/CosmeticEnhancers/");
                                return {
                                    ItemType: mod,
                                    ItemCount: isArcane ? ((fusionLimit + 1) * (fusionLimit + 2)) / 2 : 1
                                };
                            })
                        )
                    }).done(function () {
                        updateInventory();
                    });
                }
            });
        });
    });
}

function doRemoveUnrankedMods() {
    revalidateAuthz().then(() => {
        getInventoryData().then(data => {
            window.itemListPromise.then(itemMap => {
                // Excluding unranked parazon mods and instead including ranked parazon mods because worse is better for them.
                const upgradesToSell = data.RawUpgrades.filter(upgrade => !itemMap[upgrade.ItemType]?.parazon).map(
                    upgrade => ({ String: upgrade.ItemType, Count: upgrade.ItemCount })
                );
                for (const upgrade of data.Upgrades) {
                    if (itemMap[upgrade.ItemType]?.parazon) {
                        upgradesToSell.push({ String: upgrade.ItemId.$oid, Count: 0 });
                    }
                }
                $.post({
                    url: "/api/sell.php?" + window.authz,
                    contentType: "text/plain",
                    data: JSON.stringify({
                        SellCurrency: "SC_RegularCredits",
                        SellPrice: 0,
                        Items: {
                            Upgrades: upgradesToSell
                        }
                    })
                }).done(function () {
                    updateInventory();
                });
            });
        });
    });
}

function doRemoveRankedMods() {
    revalidateAuthz().then(() => {
        getInventoryData().then(data => {
            window.itemListPromise.then(itemMap => {
                // Excluding ranked parazon mods and instead including unranked parazon mods because worse is better for them.
                const upgradesToSell = data.Upgrades.filter(upgrade => !itemMap[upgrade.ItemType]?.parazon).map(
                    upgrade => ({ String: upgrade.ItemId.$oid, Count: 0 })
                );
                for (const upgrade of data.RawUpgrades) {
                    if (itemMap[upgrade.ItemType]?.parazon) {
                        upgradesToSell.push({ String: upgrade.ItemType, Count: upgrade.ItemCount });
                    }
                }
                $.post({
                    url: "/api/sell.php?" + window.authz,
                    contentType: "text/plain",
                    data: JSON.stringify({
                        SellCurrency: "SC_RegularCredits",
                        SellPrice: 0,
                        Items: {
                            Upgrades: upgradesToSell
                        }
                    })
                }).done(function () {
                    updateInventory();
                });
            });
        });
    });
}

function doAddMissingMaxRankMods() {
    revalidateAuthz().then(() => {
        fetch("/custom/addMissingMaxRankMods?" + window.authz).then(() => {
            updateInventory();
        });
    });
}

function doAcquireRiven() {
    let fingerprint;
    try {
        fingerprint = JSON.parse($("#addriven-fingerprint").val());
        if (typeof fingerprint !== "object") {
            fingerprint = JSON.parse(fingerprint);
        }
    } catch (e) {
        /* empty */
    }
    if (
        typeof fingerprint !== "object" ||
        !fingerprint ||
        !("compat" in fingerprint) ||
        !("pol" in fingerprint) ||
        !("buffs" in fingerprint)
    ) {
        $("#addriven-fingerprint").addClass("is-invalid").focus();
        return;
    }
    const uniqueName = "/Lotus/Upgrades/Mods/Randomized/" + $("#addriven-type").val();
    revalidateAuthz().then(() => {
        // Add riven type to inventory
        $.post({
            url: "/custom/addItems?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify([
                {
                    ItemType: uniqueName,
                    ItemCount: 1
                }
            ])
        }).done(function () {
            // Get riven's assigned id
            $.get("/api/inventory.php?" + window.authz + "&xpBasedLevelCapDisabled=1").done(data => {
                for (const rawUpgrade of data.RawUpgrades) {
                    if (rawUpgrade.ItemType === uniqueName) {
                        // Add fingerprint to riven
                        $.post({
                            url: "/api/artifacts.php?" + window.authz,
                            contentType: "text/plain",
                            data: JSON.stringify({
                                Upgrade: {
                                    ItemType: uniqueName,
                                    UpgradeFingerprint: JSON.stringify(fingerprint),
                                    ItemId: rawUpgrade.LastAdded
                                },
                                LevelDiff: 0,
                                Cost: 0,
                                FusionPointCost: 0
                            })
                        }).done(function () {
                            $("#addriven-fingerprint").val("");
                            updateInventory();
                        });
                        break;
                    }
                }
            });
        });
    });
}

function setFingerprint(ItemType, ItemId, fingerprint) {
    revalidateAuthz().then(() => {
        $.post({
            url: "/api/artifacts.php?" + window.authz,
            contentType: "text/plain",
            data: JSON.stringify({
                Upgrade: {
                    ItemType,
                    ItemId,
                    UpgradeFingerprint: JSON.stringify(fingerprint)
                },
                LevelDiff: 0,
                Cost: 0,
                FusionPointCost: 0
            })
        }).done(function () {
            updateInventory();
        });
    });
}

function doAcquireMod() {
    const maxed = !!window.maxed;
    window.maxed = false;
    const uniqueName = getKey(document.getElementById("mod-to-acquire"));
    if (!uniqueName) {
        $("#mod-to-acquire").addClass("is-invalid").focus();
        return;
    }
    const count = parseInt($("#mod-count").val());
    if (count != 0 && !Number.isNaN(count)) {
        Promise.all([window.itemListPromise, revalidateAuthz()]).then(([itemList]) => {
            $.post({
                url: "/custom/addItems?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify([
                    {
                        ItemType: uniqueName,
                        ItemCount: count,
                        Fingerprint:
                            maxed && (itemList[uniqueName].fusionLimit ?? 5) > 0
                                ? JSON.stringify({ lvl: itemList[uniqueName].fusionLimit ?? 5 })
                                : undefined
                    }
                ])
            })
                .done(function () {
                    if (count > 0) {
                        toast(loc("code_succAdded"));
                    } else {
                        toast(loc("code_succRemoved"));
                    }
                    updateInventory();
                })
                .fail(r => {
                    toast(r.responseText);
                });
        });
    }
}
