import type { IVendor, IVendorOffer } from "warframe-public-export-plus";
import { ROAD_TO_TAU_VENDOR, roadToTauVendor } from "./roadToTauVendor.ts";

const MELICA_VENDOR_MANIFEST = "/Lotus/Types/Game/VendorManifests/Hubs/MelicaVendorManifest";
const LEGACY_MELICA_VENDOR_MANIFEST = "/Lotus/Types/Game/VendorManifests/Zariman/MelicaVendorManifest";
const MELICA_CURRENCY = "/Lotus/Types/Gameplay/Zariman/Resources/EntropicKuvaItem";

const melicaOffer = (
    storeItem: string,
    cost: number,
    options: {
        quantity?: number;
        alwaysOffered?: boolean;
        probability?: number;
        purchaseLimit?: number;
        durationHours?: number;
    } = {}
): IVendorOffer => ({
    storeItem,
    quantity: options.quantity ?? 1,
    alwaysOffered: options.alwaysOffered ?? true,
    bin: 0,
    ...(options.probability !== undefined ? { probability: options.probability } : {}),
    duplicates: 0,
    itemPrices: [{ ItemType: MELICA_CURRENCY, ItemCount: cost }],
    ...(options.purchaseLimit !== undefined ? { purchaseLimit: options.purchaseLimit } : {}),
    ...(options.durationHours !== undefined ? { durationHours: options.durationHours } : {})
});

const melicaCommonOffers: IVendorOffer[] = [
    melicaOffer("/Lotus/StoreItems/Types/Recipes/WarframeRecipes/NarinBlueprint", 400),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/WarframeRecipes/NarinChassisBlueprint", 130),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/WarframeRecipes/NarinHelmetBlueprint", 130),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/WarframeRecipes/NarinSystemsBlueprint", 130),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/DuelistBowBlueprint", 200),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimbBlueprint", 50),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistBowStringBlueprint", 50),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistBowGripBlueprint", 50),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimbBlueprint", 50),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/DuelistPistolsBlueprint", 200),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrelBlueprint", 30),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiverBlueprint", 30),
    melicaOffer("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLinkBlueprint", 60),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Sigils/FrozenSigil", 250),
    melicaOffer("/Lotus/StoreItems/Types/Items/Titles/NarinTitle", 500),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Effects/DuelistSpiritEphemera", 500),
    melicaOffer("/Lotus/StoreItems/Types/Items/ShipDecos/TarotCardNarin", 500),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Liset/DuelistHoodOrnament", 500),
    melicaOffer("/Lotus/StoreItems/Types/Items/MiscItems/PhotoboothTileTWWMountainPeakHub", 500),
    melicaOffer("/Lotus/StoreItems/Types/Items/PhotoBooth/Zariman/PhotoboothTileZarMelicaLab", 500),
    melicaOffer("/Lotus/StoreItems/Types/Items/SongItems/NeotesDanceSongItem", 50),
    melicaOffer("/Lotus/StoreItems/Types/Items/SongItems/IceSpeakerSongItem", 50),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/DuelistArmour/DuelistArmourA", 80),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/DuelistArmour/DuelistArmourC", 80),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/DuelistArmour/DuelistArmourL", 80),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/Daggers/ArchonDaggerDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/Swords/DarkSplitSwordDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/Swords/DarkDaggerDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/Swords/DarkSwordDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/GreatSword/BallasSwordDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/Glaives/TeshinGlaiveDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/LongGuns/CrpFreezeRayDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Weapons/LongGuns/RailjackRifleDuelistSkin", 150),
    melicaOffer("/Lotus/StoreItems/Upgrades/Skins/Liset/LisetDuelistSkin", 150)
];

const legacyMelicaVendor: IVendor = {
    isDynamic: false,
    items: [...melicaCommonOffers, melicaOffer("/Lotus/StoreItems/Types/Items/MiscItems/Kuva", 150)]
};

const melicaHubVendor: IVendor = {
    isDynamic: true,
    items: [
        ...melicaCommonOffers.slice(0, 20),
        melicaOffer("/Lotus/StoreItems/Types/Items/PhotoBooth/Zariman/PhotoboothTileZarMelicaLabTreasureRoom", 500),
        ...melicaCommonOffers.slice(20),
        ...["A", "B", "C", "D", "E", "F", "G", "H"].map(letter =>
            melicaOffer(`/Lotus/StoreItems/Types/Items/ShipDecos/NarinPoem/NarinPoem${letter}`, 10)
        ),
        melicaOffer("/Lotus/StoreItems/Types/Items/MiscItems/Kuva", 150, {
            quantity: 10500,
            alwaysOffered: false,
            probability: 0.80000001,
            purchaseLimit: 4,
            durationHours: 168
        })
    ]
};

export const supplementalVendors: Record<string, IVendor> = {
    [ROAD_TO_TAU_VENDOR]: roadToTauVendor,
    "/Lotus/Types/Game/VendorManifests/Hubs/RailjackResourcesVendorManifest": {
        isDynamic: false,
        items: [
            {
                storeItem: "/Lotus/StoreItems/Weapons/CrewShip/MultitoolAmmoItem",
                quantity: 1,
                alwaysOffered: true,
                bin: 0,
                duplicates: 0,
                itemPrices: [
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/PustrelsRailjackItem",
                        ItemCount: 5
                    },
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/CubicsRailjackItem",
                        ItemCount: 5
                    }
                ]
            },
            {
                storeItem: "/Lotus/StoreItems/Weapons/CrewShip/EnergyAmmoItem",
                quantity: 1,
                alwaysOffered: true,
                bin: 0,
                duplicates: 0,
                itemPrices: [
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/CopernicsRailjackItem",
                        ItemCount: 15
                    },
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/CubicsRailjackItem",
                        ItemCount: 15
                    }
                ]
            },
            {
                storeItem: "/Lotus/StoreItems/Weapons/CrewShip/Missiles/MissileAmmoItem",
                quantity: 1,
                alwaysOffered: true,
                bin: 0,
                duplicates: 0,
                itemPrices: [
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/CarbidesRailjackItem",
                        ItemCount: 10
                    },
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/CopernicsRailjackItem",
                        ItemCount: 10
                    }
                ]
            },
            {
                storeItem: "/Lotus/StoreItems/Weapons/CrewShip/Laser/MegaLaserAmmoItem",
                quantity: 1,
                alwaysOffered: true,
                bin: 0,
                duplicates: 0,
                itemPrices: [
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/PustrelsRailjackItem",
                        ItemCount: 25
                    },
                    {
                        ItemType: "/Lotus/Types/Items/RailjackMiscItems/CarbidesRailjackItem",
                        ItemCount: 20
                    }
                ]
            }
        ]
    },
    [LEGACY_MELICA_VENDOR_MANIFEST]: legacyMelicaVendor,
    [MELICA_VENDOR_MANIFEST]: melicaHubVendor
};
