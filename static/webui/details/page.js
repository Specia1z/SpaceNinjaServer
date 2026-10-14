// DetailedView Route

single.getRoute("#detailedView-route").on("beforeload", async function () {
    if (!inventory_data) {
        document.getElementById("detailedView-loading").classList.remove("d-none");
        document.getElementById("detailedView-title").textContent = "";
        document.querySelector("#detailedView-route .text-body-secondary").textContent = "";
        document.getElementById("loadout-card").classList.add("d-none");
        document.getElementById("archonShards-card").classList.add("d-none");
        document.getElementById("edit-suit-invigorations-card").classList.add("d-none");
        document.getElementById("umbraEchoes-card").classList.add("d-none");
        document.getElementById("modularParts-card").classList.add("d-none");
        document.getElementById("modularParts-form").innerHTML = "";
        document.getElementById("valenceBonus-card").classList.add("d-none");
        document.getElementById("u5ModEdit-card").classList.add("d-none");
        document.getElementById("equipmentFeatures-card").classList.add("d-none");
        document.getElementById("equipmentFeaturesButtons-card").innerHTML = "";
    }
    populateDetailedViewRoute();
});

async function populateDetailedViewRoute() {
    const [data, itemMap] = await Promise.all([
        inventory_data ? Promise.resolve(inventory_data) : awaitAuthz().then(getInventoryData),
        window.itemListPromise
    ]);

    const urlParams = new URLSearchParams(window.location.search);
    const oid = urlParams.get("itemId");
    const category = urlParams.get("productCategory");
    const item = data[category].find(x => x.ItemId.$oid == oid);

    if (item) {
        document.getElementById("detailedView-loading").classList.add("d-none");
        const itemName = itemMap[item.ItemType]?.name ?? item.ItemType;
        if (item.ItemName) {
            const pipeIndex = item.ItemName.indexOf("|");
            if (pipeIndex != -1) {
                $("#detailedView-title").text(item.ItemName.substr(1 + pipeIndex) + " " + itemName);
                document.querySelector("#detailedView-route .text-body-secondary").textContent = "";
            } else {
                $("#detailedView-title").text(item.ItemName);
                $("#detailedView-route .text-body-secondary").text(itemName);
            }
        } else {
            $("#detailedView-title").text(itemName);
            document.querySelector("#detailedView-route .text-body-secondary").textContent = "";
        }

        if (category != "Upgrades") {
            document.getElementById("equipmentFeatures-card").classList.remove("d-none");
            const buttonsCard = document.getElementById("equipmentFeaturesButtons-card");
            buttonsCard.innerHTML = "";
            item.Features ??= 0;
            const bits = [];

            if (category != "OperatorAmps") bits.push(1);
            if (["Suits", "LongGuns", "Pistols", "Melee"].includes(category)) bits.push(2);
            if (modularWeapons.includes(item.ItemType)) bits.push(8);
            if (["LongGuns", "Pistols", "Melee", "SpaceGuns", "OperatorAmps"].includes(category)) bits.push(32);
            if (category == "SpaceGuns") bits.push(4, 64);
            if (
                [item.ItemType, itemMap[item.ItemType]?.parentName].some(
                    type => type && itemMap[type]?.evolutionWeapon && !itemMap[type]?.permanentEvolutionWeapon
                )
            )
                bits.push(512);
            if (
                ["LongGuns", "Pistols", "Melee", "SpaceGuns", "SpaceMelee"].includes(category) &&
                item.UpgradeFingerprint
            )
                bits.push(1024);
            for (const bit of bits.sort((a, b) => a - b)) {
                const wrapper = document.createElement("div");
                wrapper.classList = "form-check";

                const input = document.createElement("input");
                input.classList = "form-check-input";
                input.type = "checkbox";
                input.id = `detailedView-feature-${bit}`;
                input.checked = item.Features & bit;

                const label = document.createElement("label");
                label.classList = "form-check-label";
                label.htmlFor = input.id;
                let locString = `code_feature_${bit}`;
                if (
                    !["Suits", "SpaceSuits", "Hoverboards", "MechSuits", "Sentinels", "MoaPets", "KubrowPets"].includes(
                        category
                    ) &&
                    bit === 1
                ) {
                    locString = `code_feature_${bit}_alt`;
                }
                label.innerHTML = loc(locString);
                label.setAttribute("data-loc", locString);

                input.onchange = function (event) {
                    event.preventDefault();
                    equipmentFeatures(category, oid, bit);
                };
                wrapper.appendChild(input);
                wrapper.appendChild(label);
                buttonsCard.appendChild(wrapper);
            }
        } else {
            document.getElementById("equipmentFeatures-card").classList.add("d-none");
            document.getElementById("equipmentFeaturesButtons-card").innerHTML = "";
        }

        if (category == "Suits") {
            document.getElementById("archonShards-card").classList.remove("d-none");

            const uniqueUpgrades = {};
            (item.ArchonCrystalUpgrades ?? []).forEach(upgrade => {
                if (upgrade && upgrade.UpgradeType) {
                    uniqueUpgrades[upgrade.UpgradeType] ??= 0;
                    uniqueUpgrades[upgrade.UpgradeType] += 1;
                }
            });

            document.getElementById("crystals-list").innerHTML = "";
            Object.entries(uniqueUpgrades).forEach(([upgradeType, count]) => {
                const tr = document.createElement("tr");
                {
                    const td = document.createElement("td");
                    td.textContent = count + "x " + (archonCrystalUpgrades[upgradeType] ?? upgradeType);
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
                            doPopArchonCrystalUpgrade(upgradeType);
                        };
                        a.title = loc("code_remove");
                        a.innerHTML = icons.trash;
                        td.appendChild(a);
                    }
                    tr.appendChild(td);
                }
                document.getElementById("crystals-list").appendChild(tr);
            });

            {
                document.getElementById("edit-suit-invigorations-card").classList.remove("d-none");
                document.getElementById("invigoration-offensive").value = item.OffensiveUpgrade || "";
                document.getElementById("invigoration-defensive").value = item.DefensiveUpgrade || "";
                document.getElementById("invigoration-expiry").value =
                    formatDatetime("%Y-%m-%d %H:%M", Number(item.UpgradesExpiry?.$date.$numberLong)) || "";
            }

            if (item.ItemType != "/Lotus/Powersuits/Excalibur/ExcaliburUmbra") {
                document.getElementById("umbraEchoes-card").classList.remove("d-none");
                document.getElementById("umbraEchoes-expiry").value =
                    formatDatetime("%Y-%m-%d %H:%M", Number(item.UmbraDate?.$date.$numberLong)) || "";
            }

            {
                document.getElementById("loadout-card").classList.remove("d-none");
                const maxModConfigNum = Math.min(2 + (item.ModSlotPurchases ?? 0), 5);

                const configs = item.Configs ?? [];

                const loadoutTabs = document.getElementById("loadoutTabs");
                const loadoutTabsContent = document.getElementById("loadoutTabsContent");
                loadoutTabs.innerHTML = "";
                loadoutTabsContent.innerHTML = "";
                for (let i = 0; i <= maxModConfigNum; i++) {
                    const config = configs[i] ?? {};

                    {
                        const li = document.createElement("li");
                        li.classList.add("nav-item");

                        const button = document.createElement("button");
                        button.classList.add("nav-link");
                        if (i === 0) button.classList.add("active");
                        button.id = `config${i}-tab`;
                        button.setAttribute("data-bs-toggle", "tab");
                        button.setAttribute("data-bs-target", `#config${i}`);
                        button.innerHTML = config.Name?.trim() || String.fromCharCode(65 + i);

                        li.appendChild(button);
                        loadoutTabs.appendChild(li);
                    }

                    {
                        const tabDiv = document.createElement("div");
                        tabDiv.classList = "tab-pane";
                        if (i === 0) tabDiv.classList.add("show", "active");

                        tabDiv.id = `config${i}`;

                        {
                            const abilityOverrideForm = document.createElement("form");
                            abilityOverrideForm.classList = "form-group mt-2";
                            abilityOverrideForm.setAttribute(
                                "onsubmit",
                                `handleAbilityOverride(event, ${i});return false;`
                            );

                            const abilityOverrideFormLabel = document.createElement("label");
                            abilityOverrideFormLabel.setAttribute("data-loc", "abilityOverride_label");
                            abilityOverrideFormLabel.innerHTML = loc("abilityOverride_label");
                            abilityOverrideFormLabel.classList = "form-label";
                            abilityOverrideFormLabel.setAttribute("for", `abilityOverride-ability-config-${i}`);
                            abilityOverrideForm.appendChild(abilityOverrideFormLabel);

                            const abilityOverrideInputGroup = document.createElement("div");
                            abilityOverrideInputGroup.classList = "input-group";
                            abilityOverrideForm.appendChild(abilityOverrideInputGroup);

                            const abilityOverrideInput = document.createElement("input");
                            abilityOverrideInput.id = `abilityOverride-ability-config-${i}`;
                            abilityOverrideInput.classList = "form-control";
                            abilityOverrideInput.setAttribute("list", "datalist-Abilities");
                            if (config.AbilityOverride) {
                                const datalist = document.getElementById("datalist-Abilities");
                                const options = Array.from(datalist.options);
                                abilityOverrideInput.value =
                                    options.find(
                                        option => config.AbilityOverride.Ability == option.getAttribute("data-key")
                                    )?.value || "";
                            }
                            abilityOverrideInputGroup.appendChild(abilityOverrideInput);

                            const abilityOverrideOnSlot = document.createElement("span");
                            abilityOverrideOnSlot.classList = "input-group-text";
                            abilityOverrideOnSlot.setAttribute("data-loc", "abilityOverride_onSlot");
                            abilityOverrideOnSlot.innerHTML = loc("abilityOverride_onSlot");
                            abilityOverrideInputGroup.appendChild(abilityOverrideOnSlot);

                            const abilityOverrideSecondInput = document.createElement("input");
                            abilityOverrideSecondInput.id = `abilityOverride-ability-index-config-${i}`;
                            abilityOverrideSecondInput.classList = "form-control";
                            abilityOverrideSecondInput.setAttribute("type", "number");
                            abilityOverrideSecondInput.setAttribute("min", "1");
                            abilityOverrideSecondInput.setAttribute("max", "4");
                            if (config.AbilityOverride)
                                abilityOverrideSecondInput.value = config.AbilityOverride.Index + 1;
                            abilityOverrideInputGroup.appendChild(abilityOverrideSecondInput);

                            const abilityOverrideSetButton = document.createElement("button");
                            abilityOverrideSetButton.classList = "btn btn-primary";
                            abilityOverrideSetButton.setAttribute("type", "submit");
                            abilityOverrideSetButton.setAttribute("value", "set");
                            abilityOverrideSetButton.setAttribute("data-loc", "general_setButton");
                            abilityOverrideSetButton.innerHTML = loc("general_setButton");
                            abilityOverrideInputGroup.appendChild(abilityOverrideSetButton);

                            const abilityOverrideRemoveButton = document.createElement("button");
                            abilityOverrideRemoveButton.classList = "btn btn-danger";
                            abilityOverrideRemoveButton.setAttribute("type", "submit");
                            abilityOverrideRemoveButton.setAttribute("value", "remove");
                            abilityOverrideRemoveButton.setAttribute("data-loc", "code_remove");
                            abilityOverrideRemoveButton.innerHTML = loc("code_remove");
                            abilityOverrideInputGroup.appendChild(abilityOverrideRemoveButton);

                            abilityOverrideForm.appendChild(abilityOverrideInputGroup);

                            tabDiv.appendChild(abilityOverrideForm);
                        }

                        loadoutTabsContent.appendChild(tabDiv);
                    }
                }
            }
        } else {
            document.getElementById("loadout-card").classList.add("d-none");
            document.getElementById("archonShards-card").classList.add("d-none");
            document.getElementById("edit-suit-invigorations-card").classList.add("d-none");
            document.getElementById("umbraEchoes-card").classList.add("d-none");
        }

        if (["LongGuns", "Pistols", "Melee", "SpaceGuns", "SpaceMelee"].includes(category)) {
            document.getElementById("valenceBonus-card").classList.remove("d-none");
            document.getElementById("valenceBonus-innateDamage").value = "";
            document.getElementById("valenceBonus-procent").value = 25;

            if (item.UpgradeFingerprint) {
                const buff = JSON.parse(item.UpgradeFingerprint).buffs[0];
                const buffValue = fromUpgradeFingerprintValue(buff.Value, 0.25);
                document.getElementById("valenceBonus-innateDamage").value = buff.Tag ?? "";
                document.getElementById("valenceBonus-procent").value = Math.round(buffValue * 1000) / 10;
            }
        } else {
            document.getElementById("valenceBonus-card").classList.add("d-none");
        }

        if (itemMap[item.ItemType]?.badReason == "u5mod") {
            document.getElementById("u5ModEdit-card").classList.remove("d-none");
            const oldFitsSelect = document.getElementById("u5ModEdit-fits");
            const fitsSelect = oldFitsSelect.cloneNode(false);
            oldFitsSelect.parentNode.replaceChild(fitsSelect, oldFitsSelect);
            const upgradeFields = document.getElementById("u5ModEdit-upgradeFields");
            upgradeFields.innerHTML = "";
            const fits = itemMap[item.ItemType].fits;
            const fp = JSON.parse(item.UpgradeFingerprint);
            // const statAtten = fits.find(fit => fit.type == fp.fits).statAtten || 1;
            const statAtten = 1;

            fits.forEach(fit => {
                const option = document.createElement("option");
                option.value = fit.type;
                option.textContent = itemMap[fit.type]?.name ?? fit.type;
                // + (fit.statAtten ? ` (${loc("code_statAtten")}: ${fit.statAtten || 1})` : "");
                fitsSelect.appendChild(option);
            });

            fitsSelect.addEventListener("change", () => {
                upgradeFields.querySelectorAll(".upgrade-group").forEach(group => {
                    updateUpgradeInput(itemMap[item.ItemType], group);
                });
            });

            upgradeFields.setAttribute("data-stat-atten", statAtten);
            document.getElementById("u5ModEdit-reqLevel").value = fp.reqLevel ?? 0;
            document.getElementById("u5ModEdit-fits").value = fp.fits ?? fits[0].type;

            fp.upgrades.forEach(up => {
                createUpgradeInput(upgradeFields, itemMap, item.ItemType, up);
            });
            createUpgradeInput(upgradeFields, itemMap, item.ItemType, null);
        } else {
            document.getElementById("u5ModEdit-card").classList.add("d-none");
        }

        if (modularWeapons.includes(item.ItemType)) {
            document.getElementById("modularParts-card").classList.remove("d-none");
            const form = document.getElementById("modularParts-form");
            form.innerHTML = "";
            const requiredParts = getRequiredParts(category, item.ItemType);

            requiredParts.forEach(modularPart => {
                const input = document.createElement("input");
                input.classList.add("form-control");
                input.id = "detailedView-modularPart-" + modularPart;
                input.setAttribute("list", "datalist-ModularParts-" + modularPart);

                const datalist = document.getElementById("datalist-ModularParts-" + modularPart);
                const options = Array.from(datalist.options);

                input.value =
                    options.find(option => item.ModularParts.includes(option.getAttribute("data-key")))?.value || "";
                form.appendChild(input);
            });

            const changeButton = document.createElement("button");
            changeButton.classList.add("btn");
            changeButton.classList.add("btn-primary");
            changeButton.type = "submit";
            changeButton.setAttribute("data-loc", "cheats_changeButton");
            changeButton.innerHTML = loc("cheats_changeButton");
            form.appendChild(changeButton);
        } else {
            document.getElementById("modularParts-card").classList.add("d-none");
            document.getElementById("modularParts-form").innerHTML = "";
        }
    } else {
        single.loadRoute("/webui/inventory");
    }
}

function doPushArchonCrystalUpgrade() {
    const urlParams = new URLSearchParams(window.location.search);
    const uniqueName = getKey(document.querySelector("[list='datalist-archonCrystalUpgrades']"));
    if (!uniqueName) {
        $("[list='datalist-archonCrystalUpgrades']").addClass("is-invalid").focus();
        return;
    }
    revalidateAuthz().then(() => {
        $.get(
            `/custom/pushArchonCrystalUpgrade?${window.authz}&oid=${urlParams.get("itemId")}&type=${uniqueName}&count=${$("#archon-crystal-add-count").val()}`
        ).done(function (updatedSuit) {
            $("[list='datalist-archonCrystalUpgrades']").val("");

            const index = inventory_data.Suits.findIndex(x => x.ItemId.$oid == urlParams.get("itemId"));
            inventory_data.Suits[index] = updatedSuit;
            populateDetailedViewRoute();
        });
    });
}

function doPopArchonCrystalUpgrade(type) {
    const urlParams = new URLSearchParams(window.location.search);
    revalidateAuthz().then(() => {
        $.get(
            "/custom/popArchonCrystalUpgrade?" + window.authz + "&oid=" + urlParams.get("itemId") + "&type=" + type
        ).done(function (updatedSuit) {
            const index = inventory_data.Suits.findIndex(x => x.ItemId.$oid == urlParams.get("itemId"));
            inventory_data.Suits[index] = updatedSuit;
            populateDetailedViewRoute();
        });
    });
}

function fromUpgradeFingerprintValue(raw, min) {
    const range = 0.6 - min;
    return min + (raw * range) / 0x3fffffff;
}

function toUpgradeFingerprintValue(value, min) {
    const range = 0.6 - min;
    return Math.trunc(((value - min) * 0x3fffffff) / range);
}

function fromU5UpgradeFingerprintValue(raw, min, max) {
    const range = max - min;
    return min + range * raw;
}

function toU5UpgradeFingerprintValue(value, min, max) {
    const range = max - min;
    return (value - min) / range;
}

function handleValenceBonusChange(event) {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const action = event.submitter.value;
    const Tag = document.getElementById("valenceBonus-innateDamage").value;
    const Value = toUpgradeFingerprintValue(document.getElementById("valenceBonus-procent").value / 100, 0.25);
    revalidateAuthz().then(() => {
        $.post({
            url: "/custom/updateFingerprint?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({
                category: urlParams.get("productCategory"),
                oid: urlParams.get("itemId"),
                action,
                upgradeType: "/Lotus/Weapons/Grineer/KuvaLich/Upgrades/InnateDamageRandomMod",
                upgradeFingerprint: {
                    buffs: [
                        {
                            Tag,
                            Value
                        }
                    ]
                }
            })
        }).done(function () {
            inventory_data = undefined; // UI is up-to-date now, but subsequent updates will need to grab new data
        });
    });
}

function handleU5ModEdit(event) {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const action = event.submitter.value;
    revalidateAuthz().then(() => {
        const upgradeFields = document.getElementById("u5ModEdit-upgradeFields");
        const upgradeGroups = Array.from(upgradeFields.children);
        const upgrades = upgradeGroups
            .map(group => {
                const upgradeSelect = group.querySelector("#u5ModEdit-upgradeType");
                const raritySelect = group.querySelector("#u5ModEdit-upgradeRarity");
                const valueInput = group.querySelector("#u5ModEdit-upgradeValue");
                const statAtten = parseFloat(group.parentNode.getAttribute("data-stat-atten"));
                const value =
                    valueInput.valueAsNumber == valueInput.min
                        ? valueInput.valueAsNumber + 0.001
                        : valueInput.valueAsNumber;
                return {
                    upgrade: upgradeSelect.value,
                    valueRarity: raritySelect.value,
                    value: Math.min(
                        toU5UpgradeFingerprintValue(
                            value / statAtten,
                            valueInput.min / statAtten,
                            valueInput.max / statAtten
                        ),
                        1
                    )
                };
            })
            .filter(item => {
                return item.upgrade != "" && item.value != 0;
            });
        $.post({
            url: "/custom/updateFingerprint?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({
                category: urlParams.get("productCategory"),
                oid: urlParams.get("itemId"),
                action,
                upgradeFingerprint: {
                    reqLevel: Number(document.getElementById("u5ModEdit-reqLevel").value),
                    fits: document.getElementById("u5ModEdit-fits").value,
                    upgrades
                }
            })
        }).done(function () {
            toast(loc("code_succChange"));
            updateInventory();
        });
    });
}

function createUpgradeInput(targetDiv, itemMap, itemType, upgrade) {
    const meta = itemMap[itemType];
    const statAtten = targetDiv.getAttribute("data-stat-atten") || 1;

    const group = document.createElement("div");
    group.classList.add("upgrade-group", "mb-2", "d-flex", "gap-2");

    {
        const select = document.createElement("select");
        select.classList.add("form-control");
        select.id = "u5ModEdit-upgradeType";
        const optionNone = document.createElement("option");
        select.appendChild(optionNone);
        meta.upgrades.forEach(up => {
            const option = document.createElement("option");
            option.value = up.type;
            const locType =
                meta.fits[0].type == "/Lotus/Types/Game/LotusMeleeWeapon" && up.type == "WEAPON_FIRE_RATE"
                    ? "WEAPON_MELEE_FIRE_RATE"
                    : up.type;
            if (
                [
                    "AVATAR_ABILITY_DURATION",
                    "AVATAR_ABILITY_EFFICIENCY",
                    "AVATAR_ABILITY_RANGE",
                    "AVATAR_ABILITY_STRENGTH",
                    "WEAPON_ARMOR_PIERCING_DAMAGE",
                    "WEAPON_MELEE_CHARGE_RATE",
                    "WEAPON_MELEE_HEAVY_DAMAGE",
                    "WEAPON_STUN_CHANCE"
                ].includes(locType)
            ) {
                option.textContent = loc(locType);
            } else {
                option.textContent = toTitleCase(itemMap["/Lotus/Language/Labels/" + locType]?.name) ?? locType;
            }
            select.appendChild(option);
        });
        if (upgrade) {
            select.value = upgrade.upgrade;
        }
        select.addEventListener("change", () => {
            updateUpgradeInput(meta, group);
            checkAddOrDeleteUpgradeInput(itemMap, itemType);
        });
        group.appendChild(select);
    }
    {
        const select = document.createElement("select");
        select.classList.add("form-control");
        select.id = "u5ModEdit-upgradeRarity";
        ["COMMON", "UNCOMMON", "RARE"].forEach(rarity => {
            const option = document.createElement("option");
            option.value = rarity;
            const locKey = itemMap["/Lotus/Language/Labels/" + rarity]?.name ?? rarity;
            option.textContent = loc(locKey);
            option.setAttribute("data-loc", locKey);
            select.appendChild(option);
        });
        if (upgrade) {
            select.value = upgrade.valueRarity ?? "COMMON";
        } else {
            select.value = "COMMON";
        }
        select.addEventListener("change", () => updateUpgradeInput(meta, group));
        group.appendChild(select);
    }
    {
        let valueRange = [0, 0];
        let upgradeValue = 0;
        let displayAsPercent = undefined;
        if (upgrade) {
            // U5.1 client just igrone Rare value ranges
            const targetValueRarity = upgrade.valueRarity == "RARE" ? "UNCOMMON" : upgrade.valueRarity;
            const upgradeMeta = meta.upgrades.find(up => up.type == upgrade.upgrade);
            valueRange = [...(upgradeMeta.valueRarity[targetValueRarity] || [0, 0])];
            const operation = upgradeMeta.operation;
            displayAsPercent = upgradeMeta.displayAsPercent || operation == "MULTIPLY";
            if (displayAsPercent) {
                valueRange[0] = valueRange[0] * 100 - (operation == "MULTIPLY" ? 100 : 0);
                valueRange[1] = valueRange[1] * 100 - (operation == "MULTIPLY" ? 100 : 0);
            }
            upgradeValue = +(
                fromU5UpgradeFingerprintValue(upgrade.value, valueRange[0], valueRange[1]) * statAtten
            ).toFixed(1);
        }

        const inputGroup = document.createElement("div");
        inputGroup.classList.add("input-group", "d-flex", "flex-shrink-0");

        const input = document.createElement("input");
        input.type = "number";
        input.classList.add("form-control");
        input.step = "0.1";
        input.id = "u5ModEdit-upgradeValue";
        input.min = valueRange[0] ? +(valueRange[0] * statAtten).toFixed(1) : 0;
        input.max = valueRange[1] ? +(valueRange[1] * statAtten).toFixed(1) : 0;
        input.value = upgradeValue;
        input.title = loc("code_range").replace("|MIN|", input.min).replace("|MAX|", input.max);

        const rangePrefix = document.createElement("span");
        rangePrefix.textContent = "+";
        rangePrefix.classList.add("input-group-text");

        const rangeSuffix = document.createElement("span");
        rangeSuffix.classList.add("input-group-text");
        rangeSuffix.id = "u5ModEdit-upgradeValueSuffix";
        rangeSuffix.textContent = displayAsPercent ? "%" : itemMap["/Lotus/Language/UiElements/PLACEMENT_METERS"].name;

        inputGroup.appendChild(rangePrefix);
        inputGroup.appendChild(input);

        if (displayAsPercent != undefined) {
            inputGroup.appendChild(rangeSuffix);
        }

        group.appendChild(inputGroup);
    }
    targetDiv.appendChild(group);
}

function updateUpgradeInput(meta, group) {
    const fitsSelect = document.getElementById("u5ModEdit-fits");
    const fit = meta.fits.find(f => f.type == fitsSelect.value);
    const statAtten = fit?.statAtten || 1;

    const upgradeSelect = group.querySelector("#u5ModEdit-upgradeType");
    const raritySelect = group.querySelector("#u5ModEdit-upgradeRarity");
    const input = group.querySelector("#u5ModEdit-upgradeValue");
    let rangeSuffix = group.querySelector("#u5ModEdit-upgradeValueSuffix");

    const upgradeMeta = meta.upgrades.find(up => up.type == upgradeSelect.value);
    const targetValueRarity = raritySelect.value == "RARE" ? "UNCOMMON" : raritySelect.value;
    let valueRange = [...(upgradeMeta?.valueRarity[targetValueRarity] || [0, 0])];
    const operation = upgradeMeta?.operation;
    const displayAsPercent = upgradeMeta?.displayAsPercent || operation == "MULTIPLY";
    if (displayAsPercent) {
        valueRange[0] = valueRange[0] * 100 - (operation == "MULTIPLY" ? 100 : 0);
        valueRange[1] = valueRange[1] * 100 - (operation == "MULTIPLY" ? 100 : 0);
    }
    if (upgradeMeta && !rangeSuffix) {
        rangeSuffix = document.createElement("span");
        rangeSuffix.classList.add("input-group-text");
        rangeSuffix.id = "u5ModEdit-upgradeValueSuffix";
        input.parentNode.appendChild(rangeSuffix);
    }
    if (rangeSuffix) rangeSuffix.textContent = displayAsPercent ? "%" : "m";

    const oldstatAtten = parseFloat(group.parentNode.getAttribute("data-stat-atten")) || 1;
    const oldUpgradeValue = toU5UpgradeFingerprintValue(
        input.valueAsNumber / oldstatAtten,
        input.min / oldstatAtten,
        input.max / oldstatAtten
    );

    input.min = valueRange[0] ? +(valueRange[0] * statAtten).toFixed(1) : 0;
    input.max = valueRange[1] ? +(valueRange[1] * statAtten).toFixed(1) : 0;
    input.title = loc("code_range").replace("|MIN|", input.min).replace("|MAX|", input.max);
    group.parentNode.setAttribute("data-stat-atten", statAtten);

    input.value =
        +(fromU5UpgradeFingerprintValue(oldUpgradeValue, valueRange[0], valueRange[1]) * statAtten).toFixed(1) ||
        input.max;
    if (input.value < input.min) input.value = input.min;
}

function checkAddOrDeleteUpgradeInput(itemMap, itemType) {
    const upgradeFields = document.getElementById("u5ModEdit-upgradeFields");
    const upgradeGroups = Array.from(upgradeFields.children);

    upgradeGroups.forEach((group, index) => {
        const upgradeSelect = group.querySelector("#u5ModEdit-upgradeType");
        if (!upgradeSelect.value && index !== upgradeGroups.length - 1) {
            upgradeFields.removeChild(group);
        }
    });

    const lastUpgradeSelect = upgradeGroups[upgradeGroups.length - 1].querySelector("#u5ModEdit-upgradeType");

    if (lastUpgradeSelect.value) {
        createUpgradeInput(upgradeFields, itemMap, itemType, null);
    }
}

function handleModularPartsChange(event) {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const form = document.getElementById("modularParts-form");
    const inputs = form.querySelectorAll("input");
    const modularParts = [];
    inputs.forEach(input => {
        const key = getKey(input);
        if (!key) {
            input.classList.add("is-invalid");
        } else {
            modularParts.push(key);
        }
    });

    if (inputs.length == modularParts.length) {
        revalidateAuthz().then(() => {
            $.post({
                url: "/custom/changeModularParts?" + window.authz,
                contentType: "application/json",
                data: JSON.stringify({
                    category: urlParams.get("productCategory"),
                    oid: urlParams.get("itemId"),
                    modularParts
                })
            }).then(function () {
                toast(loc("code_succChange"));
                inventory_data = undefined; // UI is up-to-date now, but subsequent updates will need to grab new data
            });
        });
    }
}

function submitInvigoration(event) {
    event.preventDefault();
    const OffensiveUpgrade = document.getElementById("invigoration-offensive").value;
    const DefensiveUpgrade = document.getElementById("invigoration-defensive").value;
    const expiry = document.getElementById("invigoration-expiry").value;

    if (!OffensiveUpgrade || !DefensiveUpgrade) {
        toast(loc("code_requiredInvigorationUpgrade"), "warning");
        return;
    }

    setInvigoration({
        OffensiveUpgrade,
        DefensiveUpgrade,
        UpgradesExpiry: expiry ? new Date(expiry).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000
    });
}

function setInvigoration(data) {
    const oid = new URLSearchParams(window.location.search).get("itemId");
    $.post({
        url: "/custom/setInvigoration?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ oid, ...data })
    }).done(function (updatedSuit) {
        const index = inventory_data.Suits.findIndex(x => x.ItemId.$oid == oid);
        inventory_data.Suits[index] = updatedSuit;
        populateDetailedViewRoute();
    });
}

function submitUmbraEchoes(event) {
    event.preventDefault();
    const expiry = document.getElementById("umbraEchoes-expiry").value;
    setUmbraEchoes({
        UmbraDate: expiry ? new Date(expiry).getTime() : Date.now() + 1 * 24 * 60 * 60 * 1000
    });
}

function setUmbraEchoes(data) {
    const oid = new URLSearchParams(window.location.search).get("itemId");
    $.post({
        url: "/custom/setUmbraEchoes?" + window.authz,
        contentType: "application/json",
        data: JSON.stringify({ oid, ...data })
    }).done(function (updatedSuit) {
        const index = inventory_data.Suits.findIndex(x => x.ItemId.$oid == oid);
        inventory_data.Suits[index] = updatedSuit;
        populateDetailedViewRoute();
    });
}

function handleAbilityOverride(event, configIndex) {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const action = event.submitter.value;
    const Ability = getKey(document.getElementById(`abilityOverride-ability-config-${configIndex}`));
    const input = document.getElementById(`abilityOverride-ability-index-config-${configIndex}`);
    if (action == "set") {
        if (!Ability) {
            $(`#abilityOverride-ability-config-${configIndex}`).addClass("is-invalid").focus();
            return;
        }
        if (!input.value) {
            $(`#abilityOverride-ability-index-config-${configIndex}`).addClass("is-invalid").focus();
            return;
        }
    }
    const category = urlParams.get("productCategory");
    const oid = urlParams.get("itemId");
    const Index = input.value - 1;
    revalidateAuthz().then(() => {
        $.post({
            url: "/custom/abilityOverride?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({
                category,
                oid,
                configIndex,
                action,
                AbilityOverride: {
                    Ability,
                    Index
                }
            })
        }).done(function (updatedItem) {
            const index = inventory_data[category].findIndex(x => x.ItemId.$oid == oid);
            inventory_data[category][index] = updatedItem;
            if (action != "set") {
                populateDetailedViewRoute();
            }

            toast(loc("code_succChange"));
        });
    });
}
