import type { IKeyChainRequest } from "../types/requestTypes.ts";
import type {
    IBoosterPack,
    IBoosterPackComponent,
    IBundle,
    IInboxMessage,
    IKey,
    IMissionReward,
    IRegion,
    ISyndicate,
    IVendor,
    IVendorOffer,
    TMissionDeck,
    TRarity,
    TReward
} from "warframe-public-export-plus";
import {
    ExportBoosterPacks,
    ExportBoosters,
    ExportBundles,
    ExportCreditBundles,
    ExportCustoms,
    ExportFlavour,
    ExportGear,
    ExportKeys,
    ExportRecipes,
    ExportRegions,
    ExportRelics,
    ExportResources,
    ExportRewards,
    ExportSentinels,
    ExportSyndicates,
    ExportVendors,
    ExportWarframes,
    ExportWeapons
} from "warframe-public-export-plus";
import type { IMessage } from "../types/inboxTypes.ts";
import { logger } from "../utils/logger.ts";
import { version_compare } from "../helpers/inventoryHelpers.ts";
import vorsPrizePreU40Rewards from "../../static/fixed_responses/vorsPrizePreU40Rewards.json" with { type: "json" };
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";
import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";
import {
    supplementalBundles,
    supplementalItemNames,
    supplementalMarketPrices,
    supplementalResources,
    supplementalWeapons
} from "../constants/itemDataSupplemental.ts";
import { U42AbilityToLegacy } from "../constants/itemDataLegacyAbilities.ts";
import { supplementalKeys, supplementalSuits, supplementalUpgrades } from "../constants/itemDataSupplementalCatalog.ts";
import { preU26SpyMissionDecks, preU42YinYangRewards } from "../constants/itemDataMissionDecks.ts";
import { supplementalRecipes } from "../constants/itemDataSupplementalRecipes.ts";
import { supplementalVendors } from "../constants/itemDataVendors.ts";
import { U5ModsWeights, U5Modules } from "../constants/itemDataU5.ts";
import { slotPurchaseData, u7WeaponCosts } from "../constants/itemDataLegacyPricing.ts";
export type { IU5FingerprintUpgrade } from "../constants/itemDataU5.ts";
export {
    supplementalBundles,
    supplementalItemNames,
    supplementalMarketPrices,
    supplementalRecipes,
    supplementalResources,
    supplementalWeapons,
    supplementalKeys,
    supplementalSuits,
    supplementalUpgrades,
    supplementalVendors,
    slotPurchaseData,
    getRecipe,
    fromStoreItem,
    getDict,
    getDefaultUpgrades,
    getItemCategoryByUniqueName,
    getItemName,
    getMaxLevelCap,
    getNormalizedString,
    getPowerSuit,
    getProductCategory,
    getShipDecoByNameTag,
    getString,
    getUpgrade,
    isStoreItem,
    toStoreItem,
    U42AbilityToLegacy,
    U5ModsWeights,
    U5Modules
};
import { getWorldState } from "./worldStateService.ts";
import { getRecipe } from "./legacyRecipeService.ts";
import { getDict, getNormalizedString, getString } from "./itemDataLocalizationService.ts";
import {
    getDefaultUpgrades,
    getItemCategoryByUniqueName,
    getItemName,
    getMaxLevelCap,
    getPowerSuit,
    getProductCategory,
    getShipDecoByNameTag,
    getUpgrade
} from "./itemDataLookupService.ts";
import { fromStoreItem, isStoreItem, toStoreItem } from "./itemDataStoreItemService.ts";
import { promises as fs } from "fs";
import path from "path";
import { BL_LATEST } from "../constants/gameVersions.ts";
import { shouldDoServerQol } from "./configService.ts";
import { buildLabelToVersionInt, wikiDateToBuildVersionInt } from "../helpers/versionHelper.ts";
import baro from "../constants/baro.ts";
import type { Mutable } from "../utils/ts-utils.ts";
import { getActiveStorePromotion } from "./storeOverrideService.ts";
import { getSyncedBundle } from "./adminItemDataService.ts";
import {
    getCachedOfficialStorePrice,
    getCachedStoreBundle,
    getStoreItemLookupKeys
} from "./officialStorePriceCache.ts";

export type WeaponTypeInternal =
    | "LongGuns"
    | "Pistols"
    | "Melee"
    | "SpaceMelee"
    | "SpaceGuns"
    | "SentinelWeapons"
    | "OperatorAmps"
    | "SpecialItems";

const CURRENT_NIGHTWAVE_VENDOR = "/Lotus/Types/Game/VendorManifests/Events/RadioLegionIntermission16VendorManifest";
const NIGHTWAVE_CURRENCY = "/Lotus/Types/Items/MiscItems/NoraIntermissionSixteenCreds";

// These offers are present in the current client vendor manifest but are not yet in the npm export snapshot.
const currentNightwaveVendorAdditions: IVendorOffer[] = [
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025OkinaSkin",
        quantity: 1,
        alwaysOffered: true,
        bin: 0,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 50 }]
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025AtomosSkin",
        quantity: 1,
        alwaysOffered: true,
        bin: 0,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 50 }]
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Liset/GrineerShip/LisetGrineerShipDOTD",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 100 }],
        durationHours: 168
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025OperatorMask",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 50 }],
        durationHours: 168
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025TaxonSkin",
        quantity: 1,
        alwaysOffered: true,
        bin: 0,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 50 }]
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Scarves/DOTD2025MonarchSyandana",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 75 }],
        durationHours: 168
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025SentinelMask",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 35 }],
        durationHours: 168
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025SentinelTail",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 35 }],
        durationHours: 168
    },
    {
        storeItem: "/Lotus/StoreItems/Upgrades/Skins/Halloween/DOTD2025SentinelWings",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 35 }],
        durationHours: 168
    },
    {
        storeItem: "/Lotus/StoreItems/Types/StoreItems/AvatarImages/Seasonal/DOTD2025NoraGlyph",
        quantity: 1,
        alwaysOffered: false,
        bin: 3,
        probability: 0.80000001,
        duplicates: 0,
        itemPrices: [{ ItemType: NIGHTWAVE_CURRENCY, ItemCount: 30 }],
        durationHours: 168
    }
];

const currentNightwaveVendor: IVendor = {
    ...ExportVendors[CURRENT_NIGHTWAVE_VENDOR],
    items: [
        ...ExportVendors[CURRENT_NIGHTWAVE_VENDOR].items,
        ...currentNightwaveVendorAdditions.filter(
            addition =>
                !ExportVendors[CURRENT_NIGHTWAVE_VENDOR].items.some(item => item.storeItem == addition.storeItem)
        )
    ]
};

interface legacyCacheKey {
    target: string;
    buildLabel: string;
}

const legacyCacheKeyStore = new Map<string, legacyCacheKey>();
const legacyIndexCache = new WeakMap<legacyCacheKey, string[]>();
const legacyBoosterPacksCache = new WeakMap<legacyCacheKey, Partial<IBoosterPack>>();
const legacySolarMapCache = new WeakMap<legacyCacheKey, Record<string, IRegion>>();
const legacySyndicatesCache = new WeakMap<legacyCacheKey, ISyndicate>();

const getLegacyCacheKey = (target: string, buildLabel: string): legacyCacheKey => {
    const id = `${target}:${buildLabel}`;
    let obj = legacyCacheKeyStore.get(id);

    if (!obj) {
        obj = { target, buildLabel };
        legacyCacheKeyStore.set(id, obj);
    }

    return obj;
};

const getLegacyDataVersion = async (target: string, buildLabel: string): Promise<string | null> => {
    const index = await getLegacyData<string[]>(legacyIndexCache, target, "index");
    let selected: string | null = null;
    for (const v of index) {
        if (version_compare(v, buildLabel) <= 0) {
            selected = v;
        } else {
            break;
        }
    }
    return selected;
};

const getLegacyData = async <T>(cache: WeakMap<legacyCacheKey, T>, target: string, buildLabel: string): Promise<T> => {
    const key = getLegacyCacheKey(target, buildLabel);
    if (cache.has(key)) {
        logger.trace(`Using cached ${buildLabel} data for ${target}`);
        return cache.get(key)!;
    }

    const filePath = path.join("./static/fixed_responses/data", target, `${buildLabel}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw) as T;
    cache.set(key, json);

    logger.trace(`Cached ${buildLabel} data for ${target}`);

    return json;
};

const getLegacyBoosterPackData = async (target: string, buildLabel: string): Promise<Partial<IBoosterPack>> =>
    await getLegacyData<Partial<IBoosterPack>>(legacyBoosterPacksCache, target, buildLabel);

const getLegacySolarMapData = async (target: string, buildLabel: string): Promise<Record<string, IRegion>> =>
    await getLegacyData<Record<string, IRegion>>(legacySolarMapCache, target, buildLabel);

const getLegacySyndicateData = async (target: string, buildLabel: string): Promise<ISyndicate> =>
    await getLegacyData<ISyndicate>(legacySyndicatesCache, target, buildLabel);

const getLegacyRandomProjectionData = (buildLabel: string): Partial<IBoosterPack> => {
    const buildVersion = buildLabelToVersionInt(buildLabel);
    const key = getLegacyCacheKey("RandomProjection", buildLabel);
    if (legacyBoosterPacksCache.has(key)) {
        logger.trace(`Using cached ${buildLabel} data for RandomProjection`);
        return legacyBoosterPacksCache.get(key)!;
    }
    const relics: IBoosterPackComponent[] = Object.entries(ExportRelics)
        .filter(([ItemType, relic]) => {
            if (!relic.introducedAt) return false;
            const iBuildVersion = wikiDateToBuildVersionInt(relic.introducedAt);
            const vBuildVersion = relic.vaultedAt ? wikiDateToBuildVersionInt(relic.vaultedAt) : undefined;
            const baroRelics = baro.rest
                .filter(o => o.ItemType.startsWith("/Lotus/StoreItems/Types/Game/Projections/"))
                .map(o => fromStoreItem(o.ItemType));
            return (
                !baroRelics.includes(ItemType) &&
                !["Railjack", "Baro"].some(x => ItemType.includes(x)) &&
                ["Axi", "Neo", "Meso", "Lith"].includes(relic.era) &&
                relic.quality === "VPQ_BRONZE" &&
                iBuildVersion <= buildVersion &&
                (!vBuildVersion || vBuildVersion > buildVersion)
            );
        })
        .map(([ItemType, relic]) => ({
            Item: ItemType,
            Amount: 1,
            Rarity: relic.era === "Axi" ? "RARE" : relic.era === "Neo" ? "UNCOMMON" : "COMMON"
        }));
    const isAyaAvailable =
        (buildVersion >= buildLabelToVersionInt("2021.11.16.00.00") && // U30.9.4
            buildVersion < buildLabelToVersionInt("2022.01.25.24.00")) || // U31.0.11
        buildVersion >= buildLabelToVersionInt("2022.09.14.00.00"); // U32.0.3
    if (isAyaAvailable) {
        for (const rarity of ["COMMON", "UNCOMMON", "RARE"] as TRarity[]) {
            relics.push({
                Item: "/Lotus/Types/Items/MiscItems/SchismKey",
                Amount: 1,
                Rarity: rarity
            });
        }
    }

    legacyBoosterPacksCache.set(key, { components: relics });
    logger.trace(`Cached ${buildLabel} data for RandomProjection`);
    return { components: relics };
};

export const selfTestRandomProjection = (): boolean => {
    let allGood = true;

    const lcomponents = getLegacyRandomProjectionData(BL_LATEST).components;
    if (!("/Lotus/Types/BoosterPacks/RandomProjection" in ExportBoosterPacks) || !lcomponents) {
        logger.warn("RandomProjection validation failed: clound't get components from either PE+ or legacy data");
        allGood = false;
        return allGood;
    }
    const pcomponents = ExportBoosterPacks["/Lotus/Types/BoosterPacks/RandomProjection"].components;

    const componentEntries = Object.entries(pcomponents);
    const legacyEntries = Object.entries(lcomponents);
    const usedLegacy = new Set<string>();
    const usedComponent = new Set<string>();

    for (const [keyC, valC] of componentEntries) {
        for (const [keyL, valL] of legacyEntries) {
            if (usedLegacy.has(keyL)) continue;
            if (
                valC.Item === valL.Item &&
                valC.Amount === valL.Amount &&
                valC.Probability === valL.Probability &&
                valC.PityIncreaseRate === valL.PityIncreaseRate &&
                valC.Rarity === valL.Rarity
            ) {
                usedComponent.add(keyC);
                usedLegacy.add(keyL);
                break;
            }
        }
    }

    const remainingComponents = componentEntries.filter(([k]) => !usedComponent.has(k));
    const remainingLegacy = legacyEntries.filter(([k]) => !usedLegacy.has(k));

    if (remainingComponents.length > 0) {
        allGood = false;
        logger.warn(
            "RandomProjection validation failed: extra components in PE+",
            remainingComponents.map(([_, v]) => v)
        );
    }

    if (remainingLegacy.length > 0) {
        allGood = false;
        logger.warn(
            "RandomProjection validation failed: missing legacy matches",
            remainingLegacy.map(([_, v]) => v)
        );
    }

    return allGood;
};

export const getSyndicate = async (tag: string, buildLabel: string): Promise<ISyndicate | undefined> => {
    if (
        version_compare(buildLabel, gameToBuildVersion["37.0.0"]) < 0 ||
        (version_compare(buildLabel, gameToBuildVersion["41.0.0"]) < 0 && tag == "EntratiSyndicate")
    ) {
        const target = `ExportSyndicates/${tag}`;
        const version = await getLegacyDataVersion(target, buildLabel);
        if (version) {
            const legacyData = await getLegacySyndicateData(target, version);
            return legacyData;
        }
    }
    return ExportSyndicates[tag];
};

export const getKeyChainItems = ({ KeyChain, ChainStage }: IKeyChainRequest, buildLabel: string): readonly string[] => {
    const chainStages = getKey(KeyChain, buildLabel)?.chainStages;
    if (!chainStages) {
        throw new Error(`KeyChain ${KeyChain} does not contain chain stages`);
    }

    const keyChainStage = chainStages[ChainStage];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!keyChainStage) {
        throw new Error(`KeyChainStage ${ChainStage} not found`);
    }

    if (keyChainStage.itemsToGiveWhenTriggered.length === 0) {
        throw new Error(
            `client requested key chain items in KeyChain ${KeyChain} at stage ${ChainStage}, but they did not exist`
        );
    }

    return keyChainStage.itemsToGiveWhenTriggered;
};

export const getLevelKeyRewards = (
    levelKey: string,
    buildLabel: string
): { levelKeyRewards?: IMissionReward; levelKeyRewards2?: readonly TReward[]; levelMission?: Partial<IRegion> } => {
    const key = getKey(levelKey, buildLabel);

    const levelKeyRewards = key?.missionReward;
    let levelKeyRewards2 = key?.rewards;
    const levelMission = key?.mission;

    if (!levelKeyRewards && !levelKeyRewards2 && !levelMission) {
        logger.warn(
            `Could not find any reward information for ${levelKey}, gonna have to potentially short-change you`
        );
    }

    if (version_compare(buildLabel, gameToBuildVersion["40.0.0"]) < 0) {
        if (levelKey in vorsPrizePreU40Rewards) {
            levelKeyRewards2 = vorsPrizePreU40Rewards[levelKey as keyof typeof vorsPrizePreU40Rewards] as TReward[];
        } else {
            // Before U19 (Hotfix: Specters of the Rail 0.12, 2016-07-20), The New Strange gave Chroma component blueprints more directly.
            if (version_compare(buildLabel, "2016.07.20.00.00") < 0) {
                if (levelKey == "/Lotus/Types/Keys/DragonQuest/DragonQuestMissionTwo") {
                    levelKeyRewards2 = [
                        {
                            rewardType: "RT_STORE_ITEM",
                            itemType: "/Lotus/StoreItems/Types/Recipes/WarframeRecipes/ChromaHelmetBlueprint"
                        }
                    ];
                } else if (levelKey == "/Lotus/Types/Keys/DragonQuest/DragonQuestMissionThree") {
                    levelKeyRewards2 = [
                        {
                            rewardType: "RT_STORE_ITEM",
                            itemType: "/Lotus/StoreItems/Types/Recipes/WarframeRecipes/ChromaSystemsBlueprint"
                        }
                    ];
                }
            }
        }
    }

    return {
        levelKeyRewards,
        levelKeyRewards2,
        levelMission
    };
};

export const getKeyChainMessage = ({ KeyChain, ChainStage }: IKeyChainRequest, buildLabel: string): IMessage => {
    const chainStages = getKey(KeyChain, buildLabel)?.chainStages;
    if (!chainStages) {
        throw new Error(`KeyChain ${KeyChain} does not contain chain stages`);
    }

    let i = ChainStage;
    let chainStageMessage = chainStages[i].messageToSendWhenTriggered;
    while (!chainStageMessage) {
        if (++i >= chainStages.length) {
            break;
        }
        chainStageMessage = chainStages[i].messageToSendWhenTriggered;
    }

    if (!chainStageMessage) {
        throw new Error(
            `client requested key chain message in keychain ${KeyChain} at stage ${ChainStage} but they did not exist`
        );
    }
    return convertInboxMessage(chainStageMessage);
};

export const convertInboxMessage = (message: IInboxMessage): IMessage => {
    return {
        sndr: message.sender,
        msg: message.body,
        cinematic: message.cinematic,
        sub: message.title,
        customData: message.customData,
        att: message.attachments.length > 0 ? message.attachments : undefined,
        countedAtt: message.countedAttachments.length > 0 ? message.countedAttachments : undefined,
        icon: message.icon ?? "",
        transmission: message.transmission ?? "",
        highPriority: message.highPriority ?? false,
        r: false
    } satisfies IMessage;
};

export const getBundle = (uniqueName: string, buildLabel: string): IBundle | undefined => {
    if (
        uniqueName == "/Lotus/Types/StoreItems/Packages/StalkerPack" &&
        version_compare(buildLabel, "2024.06.12.18.42") < 0 // < 36.0.0
    ) {
        return {
            name: "/Lotus/Language/Items/StalkerPackName",
            description: "/Lotus/Language/Items/StalkerPackDesc",
            icon: "/Lotus/Interface/Icons/StoreIcons/MarketBundles/Weapons/StalkerPack.png",
            components: [
                { typeName: "/Lotus/StoreItems/Weapons/Tenno/Bows/StalkerBow", purchaseQuantity: 1 },
                { typeName: "/Lotus/StoreItems/Weapons/Tenno/ThrowingWeapons/StalkerKunai", purchaseQuantity: 1 },
                {
                    typeName: "/Lotus/StoreItems/Weapons/Tenno/Melee/Scythe/StalkerScytheWeapon",
                    purchaseQuantity: 1
                },
                {
                    typeName: "/Lotus/StoreItems/Types/StoreItems/SuitCustomizations/NinjaColourPickerItem",
                    purchaseQuantity: 1
                }
            ],
            packageDiscount: 0.059
        };
    }

    const customBundle = getCachedStoreBundle(uniqueName);
    if (customBundle) {
        const platinumCost = getCachedOfficialStorePrice(uniqueName, true);
        const creditsCost = getCachedOfficialStorePrice(uniqueName, false);
        return {
            components: customBundle.Components.map(component => ({
                typeName: component.TypeName,
                purchaseQuantity: component.PurchaseQuantity,
                ...(component.DurabilityDays !== undefined ? { durabilityDays: component.DurabilityDays } : {})
            })),
            ...(platinumCost !== undefined ? { platinumCost } : {}),
            ...(creditsCost !== undefined ? { creditsCost } : {})
        };
    }

    for (const key of getStoreItemLookupKeys(uniqueName)) {
        const syncedBundle = getSyncedBundle(key);
        if (syncedBundle) return syncedBundle;
        if (Object.hasOwn(ExportBundles, key)) return ExportBundles[key];
        if (Object.hasOwn(supplementalBundles, key)) return supplementalBundles[key];
    }
    return undefined;
};

export const isBundle = (uniqueName: string): boolean => {
    if (getCachedStoreBundle(uniqueName)) return true;
    return getStoreItemLookupKeys(uniqueName).some(
        key =>
            getSyncedBundle(key) !== undefined ||
            Object.hasOwn(ExportBundles, key) ||
            Object.hasOwn(supplementalBundles, key)
    );
};

export const getBoosterPack = async (
    uniqueName: string,
    buildLabel: string = ""
): Promise<IBoosterPack | undefined> => {
    if (
        version_compare(buildLabel, gameToBuildVersion["18.16.0"]) < 0 &&
        uniqueName == "/Lotus/Types/BoosterPacks/RandomKey"
    ) {
        const boosterPack: Mutable<IBoosterPack> = {
            name: "/Lotus/Language/Items/RandomKey",
            description: "/Lotus/Language/Items/RandomKeyDesc",
            icon: "/Lotus/Interface/Icons/Store/OrokinKey.png",
            components: [
                { Item: "/Lotus/Types/Keys/OrokinKeyA", Rarity: "COMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinKeyB", Rarity: "COMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinKeyC", Rarity: "UNCOMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinKeyD", Rarity: "UNCOMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinKeyE", Rarity: "RARE", Amount: 1 }
            ],
            rarityWeightsPerRoll: [
                { COMMON: 1, UNCOMMON: 0.05, RARE: 0.01, LEGENDARY: 0 },
                { COMMON: 1, UNCOMMON: 0.25, RARE: 0.05, LEGENDARY: 0 },
                { COMMON: 1, UNCOMMON: 0.25, RARE: 0.05, LEGENDARY: 0 },
                { COMMON: 1, UNCOMMON: 0.25, RARE: 0.05, LEGENDARY: 0 },
                { COMMON: 1, UNCOMMON: 0.25, RARE: 0.1, LEGENDARY: 0 }
            ],
            canGiveDuplicates: true,
            platinumCost: 75
        };
        if (version_compare(buildLabel, "2013.06.07.23.44") >= 0) {
            boosterPack.rarityWeightsPerRoll[4] = { COMMON: 0, UNCOMMON: 0, RARE: 1, LEGENDARY: 0 };
        }
        if (version_compare(buildLabel, gameToBuildVersion["9.1.0"]) >= 0) {
            boosterPack.components.push(
                { Item: "/Lotus/Types/Keys/OrokinCaptureKeyA", Rarity: "COMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinCaptureKeyB", Rarity: "COMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinCaptureKeyC", Rarity: "RARE", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinMobileDefenseKeyA", Rarity: "COMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinMobileDefenseKeyB", Rarity: "UNCOMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinMobileDefenseKeyC", Rarity: "RARE", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinDefenseKeyA", Rarity: "COMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinDefenseKeyB", Rarity: "UNCOMMON", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinDefenseKeyC", Rarity: "RARE", Amount: 1 }
            );
        }
        if (version_compare(buildLabel, gameToBuildVersion["10.3.3"]) >= 0) {
            boosterPack.components.push({
                Item: "/Lotus/Types/Keys/OrokinTowerSurvivalT3Key",
                Rarity: "UNCOMMON",
                Amount: 1
            });
        }
        if (version_compare(buildLabel, gameToBuildVersion["14.0.0"]) >= 0) {
            boosterPack.components.find(c => c.Item === "/Lotus/Types/Keys/OrokinTowerSurvivalT3Key")!.Rarity = "RARE";
            boosterPack.components.push(
                { Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerCaptureTier4Key", Rarity: "RARE", Amount: 1 },
                { Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerDefenseTier4Key", Rarity: "RARE", Amount: 1 },
                {
                    Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerExterminateTier4Key",
                    Rarity: "RARE",
                    Amount: 1
                },
                {
                    Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerInterceptionTier4Key",
                    Rarity: "RARE",
                    Amount: 1
                },
                {
                    Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerMobileDefenseTier4Key",
                    Rarity: "RARE",
                    Amount: 1
                },
                { Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerSurvivalTier4Key", Rarity: "RARE", Amount: 1 }
            );
        }
        if (version_compare(buildLabel, gameToBuildVersion["15.0.6"]) >= 0) {
            boosterPack.components.push(
                {
                    Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerSabotageTier1Key",
                    Rarity: "COMMON",
                    Amount: 1
                },
                {
                    Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerSabotageTier2Key",
                    Rarity: "UNCOMMON",
                    Amount: 1
                },
                {
                    Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerSabotageTier3Key",
                    Rarity: "RARE",
                    Amount: 1
                },
                { Item: "/Lotus/Types/Keys/OrokinTowerKeys/OrokinTowerSabotageTier4Key", Rarity: "RARE", Amount: 1 }
            );
        }
        return boosterPack;
    }
    if (version_compare(buildLabel, gameToBuildVersion["18.18.0"]) < 0) {
        if (
            [
                "/Lotus/Types/BoosterPacks/CommonFusionPack",
                "/Lotus/Types/BoosterPacks/PremiumUncommonFusionPack",
                "/Lotus/Types/BoosterPacks/PremiumRareFusionPack"
            ].includes(uniqueName)
        ) {
            return {
                ...ExportBoosterPacks[uniqueName],
                components: [
                    { Item: "/Lotus/Upgrades/Mods/Fusers/CommonModFuser", Rarity: "COMMON", Amount: 1 },
                    { Item: "/Lotus/Upgrades/Mods/Fusers/UncommonModFuser", Rarity: "UNCOMMON", Amount: 1 },
                    { Item: "/Lotus/Upgrades/Mods/Fusers/RareModFuser", Rarity: "RARE", Amount: 1 }
                ]
            };
        }
    }
    if (
        [
            "/Lotus/Types/BoosterPacks/RandomProjection",
            "/Lotus/Types/BoosterPacks/LoginRewardRandomProjection",
            "/Lotus/Types/BoosterPacks/RandomSyndicateProjectionPack",
            "/Lotus/Types/BoosterPacks/GreaterRandomProjection"
        ].includes(uniqueName)
    ) {
        return {
            ...ExportBoosterPacks[uniqueName],
            ...getLegacyRandomProjectionData(buildLabel)
        };
    }
    if (
        [
            "/Lotus/Types/BoosterPacks/CommonArtifactPack", // 30p
            "/Lotus/Types/BoosterPacks/UncommonArtifactPack", // 45p
            "/Lotus/Types/BoosterPacks/RareArtifactPack", // 60p
            "/Lotus/Types/BoosterPacks/PremiumUncommonArtifactPack", // 75p
            "/Lotus/Types/BoosterPacks/PremiumRareArtifactPack" // 90p
        ].includes(uniqueName)
    ) {
        // Mod packs retired in U25
        if (version_compare(buildLabel, gameToBuildVersion["25.0.0"]) < 0) {
            const target = "LotusArtifactUpgradePackBase";
            const version = await getLegacyDataVersion(target, buildLabel);
            if (version) {
                const legacyData = await getLegacyBoosterPackData(target, version);
                return {
                    ...ExportBoosterPacks[uniqueName],
                    ...legacyData
                };
            }
        }
    }

    return ExportBoosterPacks[uniqueName];
};

export const getKey = (uniqueName: string, buildLabel: string = BL_LATEST): IKey | undefined => {
    if (uniqueName == "/Lotus/Types/Keys/DragonQuest/DragonQuestKeyChain") {
        // Before U19 (Hotfix: Specters of the Rail 0.12, 2016-07-20), The New Strange gave Chroma component blueprints more directly.
        if (version_compare(buildLabel, "2016.07.20.00.00") < 0) {
            const latestData = ExportKeys[uniqueName];
            return {
                ...latestData,
                chainStages: latestData.chainStages!.map(chainStage => {
                    if ("itemsToGiveWhenTriggered" in chainStage && chainStage.itemsToGiveWhenTriggered.length == 1) {
                        if (
                            chainStage.itemsToGiveWhenTriggered[0] ==
                            "/Lotus/StoreItems/Types/Recipes/WarframeRecipes/ChromaBeaconABlueprint"
                        ) {
                            return {
                                itemsToGiveWhenTriggered: [
                                    "/Lotus/StoreItems/Types/Recipes/WarframeRecipes/ChromaChassisBlueprint"
                                ]
                            };
                        } else if (
                            chainStage.itemsToGiveWhenTriggered[0] ==
                                "/Lotus/StoreItems/Types/Recipes/WarframeRecipes/ChromaBeaconBBlueprint" ||
                            chainStage.itemsToGiveWhenTriggered[0] ==
                                "/Lotus/StoreItems/Types/Recipes/WarframeRecipes/ChromaBeaconCBlueprint"
                        ) {
                            return {
                                itemsToGiveWhenTriggered: []
                            };
                        }
                    }
                    return chainStage;
                })
            };
        }
    } else if (uniqueName == "/Lotus/Types/Keys/InfestedIntroQuest/InfestedIntroQuestKeyChain") {
        if (version_compare(buildLabel, gameToBuildVersion["37.0.0"]) < 0) {
            const latestData = ExportKeys[uniqueName];
            return {
                ...latestData,
                chainStages: [
                    latestData.chainStages![0],
                    latestData.chainStages![1],
                    latestData.chainStages![2],
                    latestData.chainStages![3],
                    latestData.chainStages![4],
                    {
                        itemsToGiveWhenTriggered: [],
                        messageToSendWhenTriggered: {
                            sender: "/Lotus/Language/Menu/Mailbox_WarframeSender",
                            title: "/Lotus/Language/G1Quests/IIQCompleteMessageTitle",
                            body: "/Lotus/Language/G1Quests/IIQCompleteMessageBody",
                            attachments: [],
                            countedAttachments: []
                        }
                    },
                    latestData.chainStages![5]
                ]
            };
        }
    } else if (uniqueName == "/Lotus/Types/Keys/ArchwingQuest/ArchwingQuestKeyChain") {
        if (version_compare(buildLabel, gameToBuildVersion["18.5.0"]) < 0) {
            const latestData = ExportKeys[uniqueName];
            return {
                ...latestData,
                chainStages: [
                    latestData.chainStages![0], // Give BP
                    latestData.chainStages![1], // Mission 1
                    latestData.chainStages![2], // Mission 2
                    {
                        itemsToGiveWhenTriggered: []
                    },
                    {
                        itemsToGiveWhenTriggered: []
                    },
                    {
                        itemsToGiveWhenTriggered: [
                            "/Lotus/StoreItems/Weapons/Tenno/Archwing/Primary/FoldingMachineGun/ArchMachineGun",
                            "/Lotus/StoreItems/Weapons/Tenno/Archwing/Melee/Archsword/ArchSwordWeapon"
                        ]
                    },
                    {
                        itemsToGiveWhenTriggered: []
                    },
                    latestData.chainStages![4], // Mission 4
                    {
                        itemsToGiveWhenTriggered: []
                    }
                ]
            };
        }
    }

    return ExportKeys[uniqueName] ?? supplementalKeys[uniqueName];
};

export const getMissionDeck = (uniqueName: string, buildLabel: string): Readonly<TMissionDeck> | undefined => {
    if (
        uniqueName == "/Lotus/Types/Game/MissionDecks/BossMissionRewards/YinYangRewards" &&
        !shouldDoServerQol("tylRegorDropsTwoEquinoxParts", buildLabel, gameToBuildVersion["42.0.0"])
    ) {
        return preU42YinYangRewards;
    }
    if (version_compare(buildLabel, gameToBuildVersion["26.0.0"]) < 0 && uniqueName in preU26SpyMissionDecks) {
        return preU26SpyMissionDecks[uniqueName];
    }
    return ExportRewards[uniqueName];
};

export const getPrice = (
    storeItemName: string,
    quantity: number = 1,
    durability: number = 0,
    usePremium: boolean,
    buildLabel: string,
    ignoreStoreOverrides: boolean = false,
    ignoreOfficialPriceCache: boolean = false
): number => {
    const bundle = isBundle(storeItemName);
    const internalName = bundle ? storeItemName : fromStoreItem(storeItemName);

    // A store override either states an absolute price (discount already applied) or a discount percentage
    // to apply to the regular price. Both are honored here so that admins can configure only a percentage.
    const storeOverride = ignoreStoreOverrides ? undefined : getActiveStorePromotion(internalName);
    if (storeOverride) {
        const overridePrice = usePremium ? storeOverride.PremiumPrice : storeOverride.RegularPrice;
        if (overridePrice !== undefined) return overridePrice * quantity;
        if (storeOverride.DiscountPercent !== undefined) {
            return applyDiscount(
                getUndiscountedPrice(
                    storeItemName,
                    quantity,
                    durability,
                    usePremium,
                    buildLabel,
                    ignoreStoreOverrides,
                    ignoreOfficialPriceCache
                ),
                storeOverride.DiscountPercent,
                quantity,
                internalName
            );
        }
    }

    if (!ignoreStoreOverrides) {
        const { FlashSales } = getWorldState(buildLabel);
        const flashSale = FlashSales.find(s => s.TypeName == internalName);
        if (flashSale) {
            if (flashSale.Discount !== undefined) {
                return applyDiscount(
                    getUndiscountedPrice(
                        storeItemName,
                        quantity,
                        durability,
                        usePremium,
                        buildLabel,
                        ignoreStoreOverrides,
                        ignoreOfficialPriceCache
                    ),
                    flashSale.Discount,
                    quantity,
                    internalName
                );
            }
            if (usePremium && flashSale.PremiumOverride !== undefined) {
                return flashSale.PremiumOverride * quantity;
            } else if (!usePremium && flashSale.RegularOverride !== undefined) {
                return flashSale.RegularOverride * quantity;
            }
        }
    }

    return getUndiscountedPrice(
        storeItemName,
        quantity,
        durability,
        usePremium,
        buildLabel,
        ignoreStoreOverrides,
        ignoreOfficialPriceCache
    );
};

// The client truncates the discounted unit price before multiplying by quantity.
const applyDiscount = (
    undiscountedTotal: number,
    discountPercent: number,
    quantity: number,
    typeName: string
): number => {
    const undiscountedUnitPrice = undiscountedTotal / quantity;
    const discountedUnitPrice = Math.floor(undiscountedUnitPrice * (1 - discountPercent / 100));
    if (discountedUnitPrice <= 0 && undiscountedUnitPrice > 0) {
        logger.warn(`discount of ${discountPercent}% results in a non-positive price for ${typeName}`);
    }
    return discountedUnitPrice * quantity;
};

export const getUndiscountedPrice = (
    storeItemName: string,
    quantity: number,
    durability: number,
    usePremium: boolean,
    buildLabel: string,
    ignoreStoreOverrides: boolean = false,
    ignoreOfficialPriceCache: boolean = false
): number => {
    if (!ignoreOfficialPriceCache) {
        const cachedPrice = getCachedOfficialStorePrice(storeItemName, usePremium);
        if (cachedPrice !== undefined) return cachedPrice * quantity;
    }
    if (usePremium && Object.hasOwn(supplementalMarketPrices, storeItemName)) {
        return supplementalMarketPrices[storeItemName] * quantity;
    }

    const bundle = isBundle(storeItemName);
    let internalName = bundle ? storeItemName : fromStoreItem(storeItemName);

    if (usePremium && storeItemName in ExportBoosters) {
        return [40, 80, 200, 400][durability] ?? 40;
    }

    if (!usePremium && version_compare(buildLabel, gameToBuildVersion["8.0.0"]) < 0 && internalName in u7WeaponCosts) {
        return u7WeaponCosts[internalName];
    }

    if (usePremium) {
        const internalNameShort = internalName.substring(internalName.lastIndexOf("/") + 1);
        if (internalNameShort in slotPurchaseData && slotPurchaseData[internalNameShort].price !== undefined) {
            return slotPurchaseData[internalNameShort].price;
        }
    }

    // Hardcoded sale in this version
    if (
        usePremium &&
        buildLabel == "2014.05.23.12.12/" &&
        storeItemName == "/Lotus/StoreItems/Types/Sentinels/SentinelPowersuits/CarrierPowerSuit"
    ) {
        return 60;
    }

    let price: number | undefined;
    if (bundle) {
        const bundle = getBundle(storeItemName, buildLabel)!;
        // A bundle that states its own aggregate price already reflects the package discount, so it must not be
        // discounted again by a store override or flash sale. Bundles priced by summing their components can be.
        if (usePremium && bundle.platinumCost !== undefined) {
            return bundle.platinumCost * quantity;
        } else if (!usePremium && bundle.creditsCost !== undefined) {
            return bundle.creditsCost * quantity;
        } else {
            let sum = 0;
            for (const component of bundle.components) {
                sum += getPrice(
                    component.typeName,
                    component.purchaseQuantity,
                    [3, 7, 30, 90].indexOf(component.durabilityDays ?? 3),
                    usePremium,
                    buildLabel,
                    ignoreStoreOverrides,
                    ignoreOfficialPriceCache
                );
            }
            const discount = typeof bundle.packageDiscount === "number" ? bundle.packageDiscount : 0.25;
            price = Math.round(sum * (1 - discount));
        }
    } else if (internalName in ExportBoosterPacks) {
        if (usePremium) price = ExportBoosterPacks[internalName].platinumCost;
    } else {
        // https://onlyg.it/PlayWF/SpaceNinjaServer/issues/3941
        if (internalName.endsWith("LeftArmor")) {
            internalName = internalName.substring(0, internalName.length - "LeftArmor".length) + "Armor";
        }

        if (usePremium && Object.hasOwn(supplementalMarketPrices, internalName)) {
            return supplementalMarketPrices[internalName] * quantity;
        }

        const categories = [
            ExportBundles,
            ExportCreditBundles,
            ExportCustoms,
            ExportFlavour,
            ExportGear,
            ExportRecipes,
            ExportResources,
            supplementalResources,
            ExportSentinels,
            ExportWarframes,
            supplementalSuits,
            supplementalWeapons,
            ExportWeapons
        ];
        const category = categories.find(c => internalName in c);
        if (category) {
            const item = category[internalName];
            if (usePremium && "platinumCost" in item) {
                price = item.platinumCost;
            } else if (!usePremium && "creditsCost" in item) {
                price = item.creditsCost;
            }
        } else {
            const recipe = getRecipe(internalName, buildLabel);
            if (recipe) {
                if (usePremium && "platinumCost" in recipe) {
                    price = recipe.platinumCost;
                } else if (!usePremium && "creditsCost" in recipe) {
                    price = recipe.creditsCost;
                }
            }
        }

        if (usePremium) {
            if (version_compare(buildLabel, gameToBuildVersion["18.16.0"]) < 0) {
                if (internalName == "/Lotus/Powersuits/Mag/Mag") {
                    price = ExportWarframes["/Lotus/Powersuits/Loki/Loki"].platinumCost;
                } else if (internalName == "/Lotus/Powersuits/Loki/Loki") {
                    price = ExportWarframes["/Lotus/Powersuits/Mag/Mag"].platinumCost;
                }
            }
            if (version_compare(buildLabel, gameToBuildVersion["18.0.2"]) < 0) {
                if (internalName == "/Lotus/Upgrades/Skins/Dragon/DragonAltHelmet") price = 40;
            }
        } else {
            // I'm not sure when they stopped selling it
            if (storeItemName == "/Lotus/StoreItems/Types/Restoratives/Cipher") price = 250;
        }
    }

    if (price == undefined) {
        throw new Error(`no price found for ${storeItemName}`);
    }

    return price * quantity;
};

export const getRegion = async (uniqueName: string, buildLabel: string): Promise<IRegion | undefined> => {
    const regions = await getRegions(buildLabel);
    return regions[uniqueName];
};

export const getRegions = async (buildLabel: string): Promise<Record<string, IRegion>> => {
    // after U27.2.0 OriginSolarMapRedux moved to binary format, so we don't have data for it
    if (version_compare(buildLabel, gameToBuildVersion["27.2.0"]) <= 0) {
        const target =
            version_compare(buildLabel, gameToBuildVersion["14.0.0"]) < 0
                ? "SolStarChart"
                : version_compare(buildLabel, gameToBuildVersion["18.16.0"]) < 0
                  ? "OriginSolarMap"
                  : "OriginSolarMapRedux";
        const version = await getLegacyDataVersion(target, buildLabel);
        if (version) {
            return await getLegacySolarMapData(target, version);
        }
    }
    return ExportRegions;
};

export const isRegionAvailableIn = (key: string, value: IRegion, buildVersion: number): boolean => {
    // Zeipel, Lua (Rescue)
    if (buildVersion >= gameToBuildVersionInt["32.2.0"]) {
        return true;
    }
    if (key == "SolNode307") {
        return false;
    }

    // Apollo, Lua (Disruption)
    if (buildVersion >= gameToBuildVersionInt["25.7.0"]) {
        return true;
    }
    if (key == "SolNode308") {
        return false;
    }

    // Kuva Fortress
    if (buildVersion >= gameToBuildVersionInt["19.0.1"]) {
        return true;
    }
    if (value.systemIndex == 18) {
        return false;
    }

    return true;
};

export const getVendor = (uniqueName: string): IVendor | undefined => {
    if (uniqueName == CURRENT_NIGHTWAVE_VENDOR) {
        return currentNightwaveVendor;
    }
    return ExportVendors[uniqueName] ?? supplementalVendors[uniqueName];
};
