// Inventory state and refresh helpers shared by inventory, mods, details and cheat routes.
var inventory_data;

function getInventoryData() {
    return new Promise((resolve, reject) => {
        if (inventory_data) {
            resolve(inventory_data);
        } else {
            $.get("/api/inventory.php?" + window.authz + "&xpBasedLevelCapDisabled=1")
                .done(data => {
                    inventory_data = data;
                    resolve(inventory_data);
                })
                .fail(reject);
        }
    });
}

function updateInventory() {
    inventory_data = undefined;
    if (
        single.getCurrentPath() == "/webui/inventory" ||
        single.getCurrentPath().startsWith("/webui/details") ||
        single.getCurrentPath() == "/webui/mods" ||
        single.getCurrentPath() == "/webui/cheats"
    ) {
        single.loadRoute(single.getCurrentPath());
    }
}

const modularWeapons = [
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimary",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryBeam",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryLauncher",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryShotgun",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimarySniper",
    "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondary",
    "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryBeam",
    "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryShotgun",
    "/Lotus/Weapons/Ostron/Melee/LotusModularWeapon",
    "/Lotus/Weapons/Sentients/OperatorAmplifiers/OperatorAmpWeapon",
    "/Lotus/Weapons/Sentients/OperatorAmplifiers/SentTrainingAmplifier/OperatorTrainingAmpWeapon",
    "/Lotus/Types/Vehicles/Hoverboard/HoverboardSuit",
    "/Lotus/Types/Friendly/Pets/MoaPets/MoaPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetAPowerSuit",
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetBPowerSuit",
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetCPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/VulpineInfestedCatbrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/HornedInfestedCatbrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/ArmoredInfestedCatbrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/VizierPredatorKubrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/PharaohPredatorKubrowPetPowerSuit",
    "/Lotus/Types/Friendly/Pets/CreaturePets/MedjayPredatorKubrowPetPowerSuit"
];
