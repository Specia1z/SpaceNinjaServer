import type { IBundle, IResource, IWeapon } from "warframe-public-export-plus";
import { ROAD_TO_TAU_CURRENCY } from "./roadToTauVendor.ts";

const supplementalResource = (name: string, icon: string): IResource => ({
    name,
    description: name,
    icon,
    codexSecret: false,
    parentName: "",
    productCategory: "MiscItems",
    showInInventory: true
});

export const supplementalResources: Record<string, IResource> = {
    // This event currency is present in the client manifest but absent from the pinned Public Export snapshot.
    [ROAD_TO_TAU_CURRENCY]: supplementalResource("Road to Tau Resource", ""),
    // Melica's currency is present in vendor manifests but absent from the pinned Public Export snapshot.
    "/Lotus/Types/Gameplay/Zariman/Resources/EntropicKuvaItem": supplementalResource("Entropic Kuva", ""),
    "/Lotus/Types/Recipes/WarframeRecipes/NarinChassisComponent": supplementalResource(
        "Narin Chassis",
        "/Lotus/Interface/Icons/StoreIcons/Warframes/Narin.png"
    ),
    "/Lotus/Types/Recipes/WarframeRecipes/NarinHelmetComponent": supplementalResource(
        "Narin Helmet",
        "/Lotus/Interface/Icons/StoreIcons/Warframes/Narin.png"
    ),
    "/Lotus/Types/Recipes/WarframeRecipes/NarinSystemsComponent": supplementalResource(
        "Narin Systems",
        "/Lotus/Interface/Icons/StoreIcons/Warframes/Narin.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimb": supplementalResource(
        "Duelist Bow Upper Limb",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistBow.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimb": supplementalResource(
        "Duelist Bow Lower Limb",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistBow.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowString": supplementalResource(
        "Duelist Bow String",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistBow.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowGrip": supplementalResource(
        "Duelist Bow Grip",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistBow.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrel": supplementalResource(
        "Duelist Pistols Barrel",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistPistols.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiver": supplementalResource(
        "Duelist Pistols Receiver",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistPistols.png"
    ),
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLink": supplementalResource(
        "Duelist Pistols Link",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistPistols.png"
    )
};

const supplementalWeapon = (name: string, productCategory: IWeapon["productCategory"], icon: string): IWeapon => ({
    name,
    parentName: "",
    icon,
    codexSecret: false,
    description: name,
    totalDamage: 1,
    omegaAttenuation: 1,
    masteryReq: 0,
    platinumCost: 230,
    productCategory,
    variantType: "VT_NORMAL",
    tradable: false
});

export const supplementalWeapons: Record<string, IWeapon> = {
    "/Lotus/Weapons/Tenno/Bows/DuelistBow/DuelistBow": supplementalWeapon(
        "Nunchasa",
        "LongGuns",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistBow.png"
    ),
    "/Lotus/Weapons/Tenno/Pistols/DuelistPistols/DuelistPistols": supplementalWeapon(
        "Aksondol",
        "Pistols",
        "/Lotus/Interface/Icons/StoreIcons/Weapons/DuelistPistols.png"
    )
};

export const supplementalBundles: Record<string, IBundle> = {
    "/Lotus/Types/StoreItems/Packages/WarframeBundles/NarinItemsBundle": {
        name: "/Lotus/Language/Bundles/NarinItemsBundleName",
        description: "/Lotus/Language/Bundles/NarinItemsBundleDesc",
        icon: "/Lotus/Interface/Icons/StoreIcons/MarketBundles/WarframeBundles/NarinItemsBundle.png",
        components: [
            { typeName: "/Lotus/StoreItems/Powersuits/Duelist/Duelist", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Upgrades/Skins/Duelist/DuelistAltHelmet", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Weapons/Tenno/Bows/DuelistBow/DuelistBow", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Weapons/Tenno/Pistols/DuelistPistols/DuelistPistols", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Upgrades/Skins/Scarves/DuelistSyandana", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Types/Items/Emotes/DuelistEmote", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Upgrades/Skins/Effects/DuelistEphemera", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Upgrades/Skins/Crowns/DuelistCrown", purchaseQuantity: 1 },
            { typeName: "/Lotus/StoreItems/Types/Items/ShipDecos/Props/LisetPropIceblade", purchaseQuantity: 1 }
        ],
        giftingBonus: "/Lotus/StoreItems/Types/Items/ShipDecos/Props/LisetPropIceblade",
        platinumCost: 990
    }
};

export const supplementalMarketPrices: Record<string, number> = {
    // Current official price for the Banshee Threnodia Collection.
    "/Lotus/Packages/BansheeDeluxe2SkinBundle": 245,
    "/Lotus/Types/StoreItems/Packages/BansheeDeluxe2SkinBundle": 245,
    "/Lotus/Types/StoreItems/Packages/DeluxeBundles/BansheeDeluxe2SkinBundle": 245,
    "/Lotus/Upgrades/Skins/Decree/BansheeDeluxeBSkin": 165,
    "/Lotus/Upgrades/Skins/Sentinels/Skins/BansheeDlxSentSkin": 40,
    "/Lotus/Upgrades/Mods/FusionBundles/MarketTier1FusionBundle": 5,
    "/Lotus/Upgrades/Mods/FusionBundles/MarketTier2FusionBundle": 15,
    "/Lotus/Upgrades/Mods/FusionBundles/MarketTier3FusionBundle": 50,
    "/Lotus/Upgrades/Mods/FusionBundles/CrewShipFusionBundles/MarketTier1CrewShipFusionBundle": 5,
    "/Lotus/Upgrades/Mods/FusionBundles/CrewShipFusionBundles/MarketTier2CrewShipFusionBundle": 15,
    "/Lotus/Upgrades/Mods/FusionBundles/CrewShipFusionBundles/MarketTier3CrewShipFusionBundle": 50,
    "/Lotus/Upgrades/Skins/Duelist/DuelistAltHelmet": 75,
    "/Lotus/Upgrades/Skins/Scarves/DuelistSyandana": 100,
    "/Lotus/Types/Items/Emotes/DuelistEmote": 25,
    "/Lotus/Upgrades/Skins/Effects/DuelistEphemera": 75,
    "/Lotus/Upgrades/Skins/Crowns/DuelistCrown": 65,
    "/Lotus/Types/Items/ShipDecos/Props/LisetPropIceblade": 35
};

export const supplementalItemNames: Record<string, string> = {
    "/Lotus/Types/Game/SolarRails/BasicSolarRail": "/Lotus/Language/Items/BasicSolarRailName",
    "/Lotus/Types/Game/LotusMeleeWeapon": "/Lotus/Language/Items/MeleeCategoryName",
    "/Lotus/Weapons/Tenno/Melee/PlayerMeleeWeapon": "/Lotus/Language/Items/MeleeCategoryName",
    "/Lotus/Weapons/Tenno/Pistol/LotusPistol": "/Lotus/Language/Items/PistolCategoryName",
    "/Lotus/Weapons/Tenno/Rifle/LotusRifle": "/Lotus/Language/Items/RifleCategoryName",
    "/Lotus/Weapons/Tenno/Shotgun/LotusShotgun": "/Lotus/Language/Items/ShotgunCategoryName",
    "/Lotus/Types/Game/PowerSuit": "/Lotus/Language/Items/Warframe",
    "/Lotus/Upgrades/Modules/Crafted/IncendiaryRifleMod": "/Lotus/Language/Items/InfernoMod",
    "/Lotus/Weapons/Tenno/Archwing/Primary/ArchGun": "/Lotus/Language/Items/ArchwingGun",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryBeam": "/Lotus/Language/Weapons/LotusModularGunName",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryLauncher": "/Lotus/Language/Weapons/LotusModularGunName",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryShotgun": "/Lotus/Language/Weapons/LotusModularGunName",
    "/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimarySniper": "/Lotus/Language/Weapons/LotusModularGunName",
    "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryBeam": "/Lotus/Language/Weapons/LotusModularGunName",
    "/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryShotgun":
        "/Lotus/Language/Weapons/LotusModularGunName",
    "/Lotus/Types/Vehicles/Hoverboard/HoverboardSuit": "/Lotus/Language/SolarisVenus/KDriveItem"
};
