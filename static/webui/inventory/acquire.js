function getKey(input) {
    return document
        .getElementById(input.getAttribute("list"))
        .querySelector("[value='" + input.value.replaceAll("'", "\\'") + "']")
        ?.getAttribute("data-key");
}

function doAcquireEquipment(category) {
    const uniqueName = getKey(document.getElementById("acquire-type-" + category));
    if (!uniqueName) {
        $("#acquire-type-" + category)
            .addClass("is-invalid")
            .focus();
        return;
    }
    revalidateAuthz().then(() => {
        const req = $.post({
            url: "/custom/addItems?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify([{ ItemType: uniqueName, ItemCount: 1 }])
        });
        req.done(modifiedPaths => {
            document.getElementById("acquire-type-" + category).value = "";
            if (modifiedPaths.length) updateInventory();
            else toast(loc("code_nothingToDo"));
        });
    });
}

function removeCustomization(uniqueName) {
    revalidateAuthz().then(() => {
        $.get("/custom/removeCustomization?" + window.authz + "&itemType=" + uniqueName).done(() => {
            inventory_data.FlavourItems.splice(
                inventory_data.FlavourItems.findIndex(x => x.ItemType == uniqueName),
                1
            );
        });
    });
}

function removeIsNew() {
    revalidateAuthz().then(() => {
        $.get("/custom/removeIsNew?" + window.authz);
    });
}

function getRequiredParts(category, WeaponType) {
    switch (category) {
        case "Hoverboards":
            return ["HB_DECK", "HB_ENGINE", "HB_FRONT", "HB_JET"];
        case "OperatorAmps":
            return ["AMP_OCULUS", "AMP_CORE", "AMP_BRACE"];
        case "Melee":
            return ["BLADE", "HILT", "HILT_WEIGHT"];
        case "LongGuns":
            return ["GUN_BARREL", "GUN_PRIMARY_HANDLE", "GUN_CLIP"];
        case "Pistols":
            return ["GUN_BARREL", "GUN_SECONDARY_HANDLE", "GUN_CLIP"];
        case "MoaPets":
            return WeaponType === "/Lotus/Types/Friendly/Pets/MoaPets/MoaPetPowerSuit"
                ? ["MOA_ENGINE", "MOA_PAYLOAD", "MOA_HEAD", "MOA_LEG"]
                : ["ZANUKA_BODY", "ZANUKA_HEAD", "ZANUKA_LEG", "ZANUKA_TAIL"];
        case "KubrowPets":
            return WeaponType.endsWith("InfestedCatbrowPetPowerSuit")
                ? ["CATBROW_ANTIGEN", "CATBROW_MUTAGEN"]
                : ["KUBROW_ANTIGEN", "KUBROW_MUTAGEN"];
    }
}

function doAcquireModularEquipment(category, WeaponType) {
    if (category === "Hoverboards") WeaponType = "/Lotus/Types/Vehicles/Hoverboard/HoverboardSuit";
    const requiredParts = getRequiredParts(category, WeaponType);
    const Parts = requiredParts
        .map(part => getKey(document.getElementById("acquire-type-" + category + "-" + part)))
        .filter(Boolean);
    if (Parts.length != requiredParts.length) {
        let isFirstPart = true;
        requiredParts.forEach(part => {
            const partSelector = document.getElementById("acquire-type-" + category + "-" + part);
            if (!getKey(partSelector)) {
                if (isFirstPart) {
                    isFirstPart = false;
                    $(partSelector).addClass("is-invalid").focus();
                } else {
                    $(partSelector).addClass("is-invalid");
                }
            }
        });
        return;
    }

    const mapping = {
        LongGuns: {
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart":
                "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryShotgun",
            "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelEgg/InfModularBarrelEggPart":
                "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryShotgun",
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelBPart":
                "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimary",
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelCPart":
                "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimary",
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelDPart":
                "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryBeam",
            "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelBeam/InfModularBarrelBeamPart":
                "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryBeam"
        },
        Pistols: {
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart":
                "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryShotgun",
            "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelEgg/InfModularBarrelEggPart":
                "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryShotgun",
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelBPart":
                "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondary",
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelCPart":
                "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondary",
            "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelDPart":
                "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryBeam",
            "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelBeam/InfModularBarrelBeamPart":
                "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryBeam"
        },
        MoaPets: {
            "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/ZanukaPetPartHeadA":
                "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetAPowerSuit",
            "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/ZanukaPetPartHeadB":
                "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetBPowerSuit",
            "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/ZanukaPetPartHeadC":
                "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetCPowerSuit"
        }
    };

    Parts.forEach(part => {
        if (mapping[category]?.[part]) WeaponType = mapping[category][part];
    });
    if (category == "KubrowPets") Parts.unshift(WeaponType);
    revalidateAuthz().then(() => {
        $.post({
            url: "/api/modularWeaponCrafting.php?" + window.authz,
            contentType: "application/octet-stream",
            data: JSON.stringify({ WeaponType, Parts, isWebUi: true })
        }).done(() => {
            const mainInput = document.getElementById("acquire-type-" + category);
            if (mainInput) {
                mainInput.value = "";
                const selectors =
                    category === "MoaPets"
                        ? ["modular-MoaPets-Zanuka", "modular-MoaPets-Moa"]
                        : category === "KubrowPets"
                          ? ["modular-KubrowPets-Catbrow", "modular-KubrowPets-Kubrow"]
                          : ["modular-" + category];
                selectors.forEach(id => document.getElementById(id).classList.add("d-none"));
            }
            requiredParts.forEach(part => {
                document.getElementById("acquire-type-" + category + "-" + part).value = "";
            });
            updateInventory();
        });
    });
}

function doAcquireEvolution() {
    const uniqueName = getKey(document.getElementById("acquire-type-EvolutionProgress"));
    if (!uniqueName) {
        $("#acquire-type-EvolutionProgress").addClass("is-invalid").focus();
        return;
    }
    window.itemListPromise.then(itemMap => {
        if (!document.querySelector("#EvolutionProgress-list [data-item-type='" + uniqueName + "']")) {
            setEvolutionProgress([
                { ItemType: uniqueName, Rank: itemMap[uniqueName]?.permanentEvolutionWeapon ? 0 : 1 }
            ]);
        } else {
            toast(loc("code_nothingToDo"));
        }
    });
}

$(document).on("input", "input, textarea", function () {
    $(this).removeClass("is-invalid");
});

function handleModularSelection(category) {
    const itemType = getKey(document.getElementById("acquire-type-" + category));
    if (webUiModularWeapons.includes(itemType)) doAcquireModularEquipment(category, itemType);
    else doAcquireEquipment(category);
}

{
    const supportedModularInventoryCategory = ["OperatorAmps", "Melee", "LongGuns", "Pistols", "MoaPets", "KubrowPets"];
    supportedModularInventoryCategory.forEach(inventoryCategory => {
        document.getElementById("acquire-type-" + inventoryCategory).addEventListener("input", function () {
            const modularFields = document.getElementById("modular-" + inventoryCategory);
            const modularFieldsMoa = document.getElementById("modular-MoaPets-Moa");
            const modularFieldsZanuka = document.getElementById("modular-MoaPets-Zanuka");
            const modularFieldsCatbrow = document.getElementById("modular-KubrowPets-Catbrow");
            const modularFieldsKubrow = document.getElementById("modular-KubrowPets-Kubrow");
            const key = getKey(this);

            if (webUiModularWeapons.includes(key)) {
                if (inventoryCategory === "MoaPets") {
                    if (key === "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetPowerSuit") {
                        modularFieldsMoa.classList.add("d-none");
                        modularFieldsZanuka.classList.remove("d-none");
                    } else if (key === "/Lotus/Types/Friendly/Pets/MoaPets/MoaPetPowerSuit") {
                        modularFieldsMoa.classList.remove("d-none");
                        modularFieldsZanuka.classList.add("d-none");
                    }
                } else if (inventoryCategory === "KubrowPets") {
                    if (key.endsWith("InfestedCatbrowPetPowerSuit")) {
                        modularFieldsCatbrow.classList.remove("d-none");
                        modularFieldsKubrow.classList.add("d-none");
                    } else if (key.endsWith("PredatorKubrowPetPowerSuit")) {
                        modularFieldsCatbrow.classList.add("d-none");
                        modularFieldsKubrow.classList.remove("d-none");
                    } else {
                        modularFieldsCatbrow.classList.add("d-none");
                        modularFieldsKubrow.classList.add("d-none");
                    }
                } else {
                    modularFields.classList.remove("d-none");
                }
            } else if (inventoryCategory === "MoaPets") {
                modularFieldsMoa.classList.add("d-none");
                modularFieldsZanuka.classList.add("d-none");
            } else if (inventoryCategory === "KubrowPets") {
                modularFieldsCatbrow.classList.add("d-none");
                modularFieldsKubrow.classList.add("d-none");
            } else {
                modularFields.classList.add("d-none");
            }
        });
    });
}
