import type { IVendor, IVendorOffer } from "warframe-public-export-plus";

export const ROAD_TO_TAU_CURRENCY = "/Lotus/Types/Gameplay/Events/RoadToTauEvent/RoadToTauEventResource";

type TRoadToTauVendorOffer = IVendorOffer & {
    // The game manifest carries this separately from PurchaseQuantityLimit.
    allowMultipurchase: boolean;
};

const roadToTauOffer = (
    storeItem: string,
    itemCount: number,
    options: {
        alwaysOffered?: boolean;
        allowMultipurchase?: boolean;
        purchaseLimit?: number;
    } = {}
): TRoadToTauVendorOffer => ({
    storeItem,
    quantity: 1,
    alwaysOffered: options.alwaysOffered ?? true,
    bin: 0,
    probability: 0.8,
    rotatedWeekly: false,
    duplicates: 0,
    durationHours: 24,
    purchaseLimit: options.purchaseLimit ?? 0,
    allowMultipurchase: options.allowMultipurchase ?? true,
    itemPrices: [{ ItemType: ROAD_TO_TAU_CURRENCY, ItemCount: itemCount }]
});

const roadToTauItems: TRoadToTauVendorOffer[] = [
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/EntNecraArmorTwo/EntNecraArmorTwoL", 175),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/EntNecraArmorTwo/EntNecraArmorTwoA", 175),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/EntNecraArmorTwo/EntNecraArmorTwoC", 175, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Operator/Amp/EntratiAmpSkin", 375),
    roadToTauOffer("/Lotus/StoreItems/Types/StoreItems/AvatarImages/VesselMaleGlyph", 100),
    roadToTauOffer("/Lotus/StoreItems/Types/StoreItems/AvatarImages/VesselFemaleGlyph", 100),
    roadToTauOffer("/Lotus/StoreItems/Types/StoreItems/AvatarImages/BabyNatahGlyph", 100),
    roadToTauOffer("/Lotus/StoreItems/Types/Items/ShipDecos/Plushies/PlushyBabyNatah", 125, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/Items/SongItems/DevourerSongItem", 125, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/Items/Titles/MoonfleshTitle", 175, { alwaysOffered: false }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Liset/PraghasaHoodOrnament", 250, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Scarves/DraculaCapeSyandana", 500, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Sigils/EpochOperationSigil", 100, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Clan/EpochOperationEmblemItem", 100, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/SentNewWarArmor/SentNewWarArmorL", 75, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/SentNewWarArmor/SentNewWarArmorA", 75, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Armor/SentNewWarArmor/SentNewWarArmorC", 75, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Weapons/Sentients/SentOctaMiniGun/SentOctaMiniGun", 150, {
        allowMultipurchase: false,
        purchaseLimit: 1
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Scarves/ValdurBackCape", 175, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Clan/SlingStoneEmblemItem", 75, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Clan/CorpusVoidBadgeItem", 75, {
        allowMultipurchase: false
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Clan/HiveSabotageEventBadgeItem", 75),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Sigils/EnergySigilA", 75, { allowMultipurchase: false }),
    roadToTauOffer("/Lotus/StoreItems/Weapons/Corpus/Pistols/CorpusModularPistol/Vandal/CrpLaserPistolVandal", 150, {
        purchaseLimit: 1
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/Recipes/Weapons/SentRifleNewWarGunBlueprint", 125),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Necramech/MechWeapon/MechEventCortegeSkin", 125),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Necramech/MechWeapon/MechEventMorghaSkin", 125),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Crowns/LaurelHaloCrown", 100),
    roadToTauOffer("/Lotus/StoreItems/Types/Items/DangerRoom/DangerRoomTileArena", 125, { purchaseLimit: 1 }),
    roadToTauOffer("/Lotus/Types/StoreItems/Packages/Calendar/CalendarKuvaBundleSmall", 20, {
        purchaseLimit: 25
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/PickUps/Credits/10000Credits", 3, { purchaseLimit: 100 }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Mods/FusionBundles/AlertFusionBundleMedium", 1, {
        purchaseLimit: 300
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalAmarMythic", 375, {
        purchaseLimit: 1
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalBorealMythic", 375, {
        purchaseLimit: 1
    }),
    roadToTauOffer("/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalNiraMythic", 375, {
        purchaseLimit: 1
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Mods/Fusers/LegendaryModFuser", 500, { purchaseLimit: 1 }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Sigils/ClanSigilBasicAdd", 50),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Sigils/ClanSigilTwoTone", 50),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/Skins/Sigils/ClanSigilMaskedEffect", 50),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/ArmorOnMeleeKill", 5, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/MeleeDamageForActiveShields", 5, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/MaxEnergyForArmor", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/AbilityPowerOnFreeze", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/DuplicateStatusOnKnock", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/HeavyCritOnRegularMelee", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/CorrosiveMeleePerAbilityCast", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/MeleeProcsSpread", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/PullEnemiesOnMeleeKill", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/OverguardSteal", 8, {
        purchaseLimit: 42
    }),
    roadToTauOffer("/Lotus/StoreItems/Upgrades/CosmeticEnhancers/Offensive/BonusDamageNextShotForCurEnergy", 8, {
        purchaseLimit: 42
    })
];

export const ROAD_TO_TAU_VENDOR = "/Lotus/Types/Game/VendorManifests/Events/RoadToTauEventVendorManifest";

export const roadToTauVendor: IVendor = {
    isDynamic: true,
    requiredGoalTag: "RoadToTauEvent",
    items: roadToTauItems
};
