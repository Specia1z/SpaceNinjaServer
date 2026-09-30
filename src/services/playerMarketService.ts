import type { HydratedDocument, Types } from "mongoose";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { ensurePlayerMarketIndexes, PlayerMarketCounter, PlayerMarketLedger, PlayerMarketState, type IPlayerMarketLedger, type IPlayerMarketState } from "../models/playerMarketModel.ts";
import { config, type IPlayerMarketConfig, type IPlayerMarketItemOverride } from "./configService.ts";
import type { TAccountDocument } from "./loginService.ts";
import {
    getExportCustoms,
    getExportDrones,
    getExportFlavour,
    getExportFusionBundles,
    getExportGear,
    getExportKeys,
    getExportRelicArcane,
    getExportResources,
    getExportSentinels,
    getExportUpgrades,
    getExportWarframes,
    getExportWeapons
} from "./publicExportService.ts";
import { resolveMarketIcon } from "./marketImageService.ts";

export type TMarketAction = "buy" | "sell";
export type TMarketMode = "stack" | "instance";

export interface IMarketPolicy {
    enabled: boolean;
    buyEnabled: boolean;
    sellEnabled: boolean;
    accountDailyPlatinumCap: number;
    accountDailyTransactionLimit: number;
    accountDailyQuantityCap: number;
    globalDailyMintCap: number;
    globalDailyTransactionLimit: number;
    globalDailyQuantityCap: number;
    priceSpreadPercent: number;
    priceChangeLimitPercent: number;
    minimumAccountAgeHours: number;
    excludedItemPatterns: string[];
    itemOverrides: Record<string, IPlayerMarketItemOverride | undefined>;
}

export interface IMarketEntry {
    inventoryField: string;
    mode: TMarketMode;
    itemType: string;
    category: string;
    displayName: string;
    icon?: string;
    owned: number;
    systemStock?: number;
    sellUnitPrice?: number;
    buyUnitPrice?: number;
    priceChangePercent?: number;
    priceChangeDirection?: "up" | "down" | "flat";
    canBuy?: boolean;
    canSell?: boolean;
}

export interface IMarketSummary {
    enabled: boolean;
    policy?: Pick<IMarketPolicy, "accountDailyPlatinumCap" | "accountDailyTransactionLimit" | "accountDailyQuantityCap" | "globalDailyMintCap" | "globalDailyTransactionLimit" | "globalDailyQuantityCap" | "minimumAccountAgeHours">;
    usage?: {
        accountTradedPlatinum: number;
        accountTransactions: number;
        accountQuantity: number;
        globalTradedPlatinum: number;
        globalTransactions: number;
        globalQuantity: number;
    };
    inventory: IMarketEntry[];
    items: IMarketEntry[];
}

const boolSetting = (value: unknown, fallback: boolean): boolean => (typeof value == "boolean" ? value : fallback);
const intSetting = (value: unknown, fallback: number, max: number): number =>
    typeof value == "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : fallback;

export const playerMarketPolicy = (): IMarketPolicy => ({
    enabled: boolSetting(config.playerMarket?.enabled, true),
    buyEnabled: boolSetting(config.playerMarket?.buyEnabled, true),
    sellEnabled: boolSetting(config.playerMarket?.sellEnabled, true),
    accountDailyPlatinumCap: intSetting(config.playerMarket?.accountDailyPlatinumCap, 200, 1_000_000),
    accountDailyTransactionLimit: intSetting(config.playerMarket?.accountDailyTransactionLimit, 30, 100_000),
    accountDailyQuantityCap: intSetting(config.playerMarket?.accountDailyQuantityCap, 10_000, 1_000_000_000),
    globalDailyMintCap: intSetting(config.playerMarket?.globalDailyMintCap, 10_000, 1_000_000_000),
    globalDailyTransactionLimit: intSetting(config.playerMarket?.globalDailyTransactionLimit, 5_000, 1_000_000),
    globalDailyQuantityCap: intSetting(config.playerMarket?.globalDailyQuantityCap, 1_000_000, 1_000_000_000),
    priceSpreadPercent: intSetting(config.playerMarket?.priceSpreadPercent, 10, 50),
    priceChangeLimitPercent: intSetting(config.playerMarket?.priceChangeLimitPercent, 5, 20),
    minimumAccountAgeHours: intSetting(config.playerMarket?.minimumAccountAgeHours, 24, 8_760),
    excludedItemPatterns: Array.isArray(config.playerMarket?.excludedItemPatterns)
        ? config.playerMarket!.excludedItemPatterns!.filter(value => typeof value == "string")
        : [],
    itemOverrides:
        config.playerMarket?.itemOverrides && typeof config.playerMarket.itemOverrides == "object"
            ? config.playerMarket.itemOverrides
            : {}
});

const policyLimits: Record<keyof Omit<IMarketPolicy, "excludedItemPatterns" | "itemOverrides">, number | null> = {
    enabled: null,
    buyEnabled: null,
    sellEnabled: null,
    accountDailyPlatinumCap: 1_000_000,
    accountDailyTransactionLimit: 100_000,
    accountDailyQuantityCap: 1_000_000_000,
    globalDailyMintCap: 1_000_000_000,
    globalDailyTransactionLimit: 1_000_000,
    globalDailyQuantityCap: 1_000_000_000,
    priceSpreadPercent: 50,
    priceChangeLimitPercent: 20,
    minimumAccountAgeHours: 8_760
};

export const validatePlayerMarketPolicy = (value: unknown): value is IPlayerMarketConfig => {
    if (!value || typeof value != "object" || Array.isArray(value)) return false;
    const input = value as Record<string, unknown>;
    for (const [key, max] of Object.entries(policyLimits)) {
        const field = input[key];
        if (max === null ? typeof field != "boolean" : typeof field != "number" || !Number.isSafeInteger(field)) return false;
        if (max !== null && ((field as number) < 0 || (field as number) > max)) return false;
    }
    if (!Array.isArray(input.excludedItemPatterns) || input.excludedItemPatterns.some(value => typeof value != "string")) return false;
    return Boolean(input.itemOverrides && typeof input.itemOverrides == "object" && !Array.isArray(input.itemOverrides));
};

export const validatePlayerMarketField = (id: string, value: unknown): string | undefined => {
    if (!id.startsWith("playerMarket.")) return undefined;
    const key = id.substring("playerMarket.".length) as keyof IMarketPolicy;
    if (key == "excludedItemPatterns") {
        return Array.isArray(value) && value.every(pattern => typeof pattern == "string") ? undefined : `${id} has an invalid value`;
    }
    if (key == "itemOverrides") {
        return value && typeof value == "object" && !Array.isArray(value) ? undefined : `${id} has an invalid value`;
    }
    if (!(key in policyLimits)) return `unknown playerMarket setting: ${id}`;
    const max = policyLimits[key as keyof typeof policyLimits];
    const valid = max === null ? typeof value == "boolean" : typeof value == "number" && Number.isSafeInteger(value);
    return valid && (max === null || ((value as number) >= 0 && (value as number) <= max)) ? undefined : `${id} has an invalid value`;
};

const currencyPatterns = ["PrimeBucks", "Credits", "Aya", "Endo", "Kuva", "Dirac", "Standing", "VoidTrace", "Currency", "Tokens"];
const excludedFields = new Set([
    "MarketRequestIds",
    "ReferralRewardClaims",
    "FoundToday",
    "MissionRelicRewards",
    "PendingRecipes",
    "QuestKeys",
    "Drones",
    "PersonalTechProjects",
    "ChallengeProgress",
    "PeriodicMissionCompletions",
    "StepSequencers",
    "DialogueHistory",
    "RecentVendorPurchases",
    "VendorPurchaseHistory",
    "Affiliations",
    "CompletedSyndicates",
    "FocusUpgrades",
    "FocusLoadouts",
    "LoadOutPresets",
    "PendingTrades"
]);

const isCurrency = (itemType: string, field: string): boolean =>
    [field, itemType].some(value => currencyPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase())));

const isExcludedItem = (itemType: string, policy: IMarketPolicy): boolean => {
    try {
        return policy.excludedItemPatterns.some(pattern => new RegExp(pattern, "i").test(itemType));
    } catch {
        return false;
    }
};

const isTradeableField = (field: string): boolean => /^[A-Za-z][A-Za-z0-9_]*$/.test(field) && !excludedFields.has(field);

type TInventoryEntry = Record<string, unknown> & { ItemType?: string; ItemCount?: number };

const marketCategoryFor = (field: string, itemType: string, productCategory?: string): string => {
    if (field == "Upgrades" || field == "RawUpgrades") return "mods";
    if (productCategory == "Suits" || productCategory == "SpaceSuits" || productCategory == "MechSuits") return "warframes";
    if (productCategory == "LongGuns") return "primary";
    if (productCategory == "Pistols") return "secondary";
    if (productCategory == "Melee" || productCategory == "DrifterMelee") return "melee";
    if (productCategory == "SentinelWeapons") return "sentinel";
    if (productCategory == "SpaceGuns" || productCategory == "SpaceMelee") return "archwing";
    if (productCategory == "WeaponSkins" || productCategory == "ShipDecorations") return "cosmetics";
    if (itemType.includes("/Resources/")) return "resources";
    if (itemType.includes("/Components/")) return "components";
    return "other";
};

const collectEntries = (inventory: Record<string, unknown>, policy: IMarketPolicy): Array<IMarketEntry & { source: TInventoryEntry[] }> => {
    const result: Array<IMarketEntry & { source: TInventoryEntry[] }> = [];
    for (const [field, value] of Object.entries(inventory)) {
        if (!isTradeableField(field) || !Array.isArray(value)) continue;
        const grouped = new Map<string, { mode: TMarketMode; count: number; source: TInventoryEntry[] }>();
        for (const candidate of value) {
            if (!candidate || typeof candidate != "object") continue;
            const entry = candidate as TInventoryEntry;
            if (typeof entry.ItemType != "string" || isCurrency(entry.ItemType, field) || isExcludedItem(entry.ItemType, policy)) continue;
            const metadata = metadataFor(entry.ItemType);
            if (metadata.excludeFromMarket || metadata.tradable === false) continue;
            const mode: TMarketMode = typeof entry.ItemCount == "number" ? "stack" : "instance";
            if (mode == "stack" && entry.ItemCount! <= 0) continue;
            if (mode == "instance" && field != "Upgrades" && !entry.UpgradeFingerprint && !entry._id) continue;
            const key = `${field}:${mode}:${entry.ItemType}`;
            const current = grouped.get(key) ?? { mode, count: 0, source: [] };
            current.count += mode == "stack" ? entry.ItemCount! : 1;
            current.source.push(entry);
            grouped.set(key, current);
        }
        for (const [key, valueInfo] of grouped) {
            const [, mode, itemType] = key.split(":");
            const metadata = metadataFor(itemType);
            const override = policy.itemOverrides[itemType];
            result.push({
                inventoryField: field,
                mode: mode as TMarketMode,
                itemType,
                category: marketCategoryFor(field, itemType, metadata.productCategory),
                displayName: override?.displayName || metadata.name || fallbackName(itemType),
                icon: metadata.icon,
                owned: valueInfo.count,
                source: valueInfo.source
            });
        }
    }
    return result;
};

const fallbackName = (itemType: string): string => (itemType.split("/").pop() || itemType).replace(/([a-z])([A-Z])/g, "$1 $2");

let metadataCache: Map<string, { name?: string; icon?: string; productCategory?: string; excludeFromMarket?: boolean; tradable?: boolean }> | undefined;
const metadataFor = (itemType: string): { name?: string; icon?: string; productCategory?: string; excludeFromMarket?: boolean; tradable?: boolean } => {
    if (!metadataCache) {
        metadataCache = new Map();
        try {
            const addCollection = (collection: unknown): void => {
                if (!Array.isArray(collection)) return;
                for (const item of collection) {
                    if (!item || typeof item != "object") continue;
                    const value = item as {
                        uniqueName?: unknown;
                        name?: unknown;
                        icon?: unknown;
                        productCategory?: unknown;
                        excludeFromMarket?: unknown;
                        tradable?: unknown;
                    };
                    if (typeof value.uniqueName != "string") continue;
                    metadataCache!.set(value.uniqueName, {
                        name: typeof value.name == "string" ? value.name : undefined,
                        icon: typeof value.icon == "string" ? value.icon : undefined,
                        productCategory: typeof value.productCategory == "string" ? value.productCategory : undefined,
                        excludeFromMarket: value.excludeFromMarket === true,
                        tradable: typeof value.tradable == "boolean" ? value.tradable : undefined
                    });
                }
            };
            const addExport = (exported: unknown): void => {
                if (!exported || typeof exported != "object") return;
                for (const collection of Object.values(exported)) addCollection(collection);
            };
            for (const exported of [
                getExportCustoms("zh"),
                getExportDrones("zh"),
                getExportFlavour("zh"),
                getExportFusionBundles("zh"),
                getExportGear("zh"),
                getExportKeys("zh"),
                getExportRelicArcane("zh"),
                getExportResources("zh"),
                getExportSentinels("zh"),
                getExportUpgrades("zh"),
                getExportWarframes("zh"),
                getExportWeapons("zh")
            ]) {
                addExport(exported);
            }
        } catch {
            // A missing metadata snapshot must not disable inventory trading.
        }
    }
    return metadataCache.get(itemType) ?? {};
};

const periodKey = (): string => new Date().toISOString().slice(0, 10);
const requestIdValid = (requestId: unknown): requestId is string => typeof requestId == "string" && /^[A-Za-z0-9_-]{16,80}$/.test(requestId);
const duplicateKey = (error: unknown): boolean => (error as { code?: number }).code == 11000;
const systemFilter = { MarketSystem: true };

const getSystemInventory = async (): Promise<{ _id: Types.ObjectId }> =>
    (await Inventory.findOneAndUpdate(systemFilter, { $setOnInsert: { MarketSystem: true } }, { upsert: true, returnDocument: "after" })) as unknown as { _id: Types.ObjectId };

const priceSettings = (itemType: string, policy: IMarketPolicy): { basePrice: number; minPrice: number; maxPrice: number } => {
    const override = policy.itemOverrides[itemType];
    const basePrice = typeof override?.basePrice == "number" && override.basePrice > 0 ? override.basePrice : 1;
    const minPrice = typeof override?.minPrice == "number" && override.minPrice > 0 ? override.minPrice : 1;
    const maxPrice = typeof override?.maxPrice == "number" && override.maxPrice >= minPrice ? override.maxPrice : Math.max(5, basePrice * 5);
    return { basePrice: Math.min(maxPrice, Math.max(minPrice, basePrice)), minPrice, maxPrice };
};

const roundMarketPrice = (value: number): number => Math.max(1, Math.ceil(value));

const quote = (
    state: { midPrice: number; systemStock: number },
    itemType: string,
    policy: IMarketPolicy
): { sellUnitPrice: number; buyUnitPrice: number; systemStock: number; midPrice: number; priceChangePercent: number; priceChangeDirection: "up" | "down" | "flat" } => {
    const prices = priceSettings(itemType, policy);
    const midPrice = Math.min(prices.maxPrice, Math.max(prices.minPrice, state.midPrice));
    const spread = policy.priceSpreadPercent / 100;
    const buyUnitPrice = roundMarketPrice(midPrice * (1 + spread));
    const baseBuyUnitPrice = roundMarketPrice(prices.basePrice * (1 + spread));
    const priceChangePercent = Number((((buyUnitPrice - baseBuyUnitPrice) / baseBuyUnitPrice) * 100).toFixed(2));
    return {
        sellUnitPrice: roundMarketPrice(midPrice * (1 - spread)),
        buyUnitPrice,
        systemStock: Math.max(0, state.systemStock),
        midPrice,
        priceChangePercent,
        priceChangeDirection: priceChangePercent > 0 ? "up" : priceChangePercent < 0 ? "down" : "flat"
    };
};

const changeStatePrice = async (field: string, itemType: string, mode: TMarketMode, side: TMarketAction, quantity: number, policy: IMarketPolicy): Promise<void> => {
    const state = await PlayerMarketState.findOne({ inventoryField: field, itemType, mode }).lean();
    if (!state) return;
    const prices = priceSettings(itemType, policy);
    const impact = Math.min(policy.priceChangeLimitPercent / 100, Math.max(0.01, quantity / 100));
    const next = Math.min(prices.maxPrice, Math.max(prices.minPrice, state.midPrice * (side == "sell" ? 1 - impact : 1 + impact)));
    await PlayerMarketState.updateOne({ _id: state._id }, { $set: { midPrice: next, updatedAt: new Date() } });
};

const getState = async (field: string, itemType: string, mode: TMarketMode, policy: IMarketPolicy): Promise<HydratedDocument<IPlayerMarketState>> => {
    const prices = priceSettings(itemType, policy);
    return PlayerMarketState.findOneAndUpdate(
        { inventoryField: field, itemType, mode },
        { $setOnInsert: { midPrice: prices.basePrice, systemStock: 0 }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" }
    );
};

const reserveCounter = async (scope: string, values: { tradedPlatinum: number; transactions: number; quantity: number }, limits: { tradedPlatinum: number; transactions: number; quantity: number }): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; ++attempt) {
        try {
            const key = periodKey();
            await PlayerMarketCounter.updateOne(
                { scope, periodKey: key },
                { $setOnInsert: { tradedPlatinum: 0, transactions: 0, quantity: 0, updatedAt: new Date() } },
                { upsert: true }
            );
            const result = await PlayerMarketCounter.findOneAndUpdate(
                {
                    scope,
                    periodKey: key,
                    $expr: {
                        $and: [
                            { $lte: [{ $add: [{ $ifNull: ["$tradedPlatinum", 0] }, values.tradedPlatinum] }, limits.tradedPlatinum] },
                            { $lte: [{ $add: [{ $ifNull: ["$transactions", 0] }, values.transactions] }, limits.transactions] },
                            { $lte: [{ $add: [{ $ifNull: ["$quantity", 0] }, values.quantity] }, limits.quantity] }
                        ]
                    }
                },
                { $inc: values, $set: { updatedAt: new Date() } },
                { returnDocument: "after" }
            );
            return Boolean(result);
        } catch (error) {
            if (!duplicateKey(error)) throw error;
        }
    }
    return false;
};

const releaseCounter = async (scope: string, values: { tradedPlatinum: number; transactions: number; quantity: number }): Promise<void> => {
    await PlayerMarketCounter.updateOne({ scope, periodKey: periodKey() }, { $inc: { tradedPlatinum: -values.tradedPlatinum, transactions: -values.transactions, quantity: -values.quantity } });
};

const pendingLedger = async (values: Omit<IPlayerMarketLedger, "status" | "createdAt">): Promise<HydratedDocument<IPlayerMarketLedger>> => {
    try {
        return (await PlayerMarketLedger.create({ ...values, status: "pending", createdAt: new Date() })) as HydratedDocument<IPlayerMarketLedger>;
    } catch (error) {
        if (duplicateKey(error)) throw new Error("market_request_in_progress");
        throw error;
    }
};

const completeLedger = async (id: Types.ObjectId): Promise<void> => {
    await PlayerMarketLedger.updateOne({ _id: id }, { $set: { status: "completed" } });
};

const addStack = async (filter: Record<string, unknown>, field: string, itemType: string, quantity: number): Promise<boolean> => {
    const path = `${field}.$[entry].ItemCount`;
    const updated = await Inventory.updateOne(
        { ...filter, [field]: { $elemMatch: { ItemType: itemType } } },
        { $inc: { [path]: quantity } },
        { arrayFilters: [{ "entry.ItemType": itemType }] }
    );
    if (updated.modifiedCount) return true;
    const inserted = await Inventory.updateOne(filter, { $push: { [field]: { ItemType: itemType, ItemCount: quantity } } });
    return Boolean(inserted.modifiedCount);
};

const removeStack = async (filter: Record<string, unknown>, field: string, itemType: string, quantity: number): Promise<boolean> => {
    const path = `${field}.$[entry].ItemCount`;
    const updated = await Inventory.updateOne(
        { ...filter, [field]: { $elemMatch: { ItemType: itemType, ItemCount: { $gte: quantity } } } },
        { $inc: { [path]: -quantity } },
        { arrayFilters: [{ "entry.ItemType": itemType, "entry.ItemCount": { $gte: quantity } }] }
    );
    return Boolean(updated.modifiedCount);
};

const identity = (entry: TInventoryEntry): string | undefined => {
    const id = entry._id;
    if (id && typeof id == "object" && "$oid" in id) return String((id as { $oid: string }).$oid);
    if (id) return String(id);
    return typeof entry.UpgradeFingerprint == "string" ? entry.UpgradeFingerprint : undefined;
};

const removeInstances = async (filter: Record<string, unknown>, field: string, selected: TInventoryEntry[]): Promise<boolean> => {
    const ids = selected.map(identity).filter((value): value is string => Boolean(value));
    if (!ids.length) return false;
    const conditions = ids.map(id => ({ [field]: { $elemMatch: { $or: [{ _id: id }, { UpgradeFingerprint: id }] } } }));
    const result = await Inventory.updateOne({ ...filter, $and: conditions }, { $pull: { [field]: { $or: [{ _id: { $in: ids } }, { UpgradeFingerprint: { $in: ids } }] } } });
    return Boolean(result.modifiedCount);
};

const addInstances = async (filter: Record<string, unknown>, field: string, entries: TInventoryEntry[]): Promise<boolean> => {
    if (!entries.length) return false;
    const copies = entries.map(entry => {
        const copy = JSON.parse(JSON.stringify(entry)) as TInventoryEntry;
        delete copy._id;
        return copy;
    });
    const result = await Inventory.updateOne(filter, { $push: { [field]: { $each: copies } } });
    return Boolean(result.modifiedCount);
};

const entriesFor = async (accountOwnerId: Types.ObjectId | undefined, system: boolean, policy: IMarketPolicy, field: string, itemType: string, mode: TMarketMode): Promise<TInventoryEntry[]> => {
    const inventory = await Inventory.findOne(system ? systemFilter : { accountOwnerId }).lean();
    if (!inventory) return [];
    return collectEntries(inventory as unknown as Record<string, unknown>, policy).find(entry => entry.inventoryField == field && entry.itemType == itemType && entry.mode == mode)?.source ?? [];
};

export const getPlayerMarketSummary = async (accountId: Types.ObjectId): Promise<IMarketSummary> => {
    await ensurePlayerMarketIndexes();
    const policy = playerMarketPolicy();
    if (!policy.enabled) return { enabled: false, inventory: [], items: [] };
    const [player, system, accountCounter, globalCounter] = await Promise.all([
        Inventory.findOne({ accountOwnerId: accountId }).lean(),
        Inventory.findOne(systemFilter).lean(),
        PlayerMarketCounter.findOne({ scope: accountId.toString(), periodKey: periodKey() }).lean(),
        PlayerMarketCounter.findOne({ scope: "global", periodKey: periodKey() }).lean()
    ]);
    const playerEntries = collectEntries((player ?? {}) as unknown as Record<string, unknown>, policy);
    const systemEntries = collectEntries((system ?? {}) as unknown as Record<string, unknown>, policy);
    const items = await Promise.all(
        systemEntries.map(async entry => {
            const state = await getState(entry.inventoryField, entry.itemType, entry.mode, policy);
            if (state.systemStock != entry.owned) {
                state.systemStock = entry.owned;
                await PlayerMarketState.updateOne({ _id: state._id }, { $set: { systemStock: entry.owned, updatedAt: new Date() } });
            }
            const current = quote({ midPrice: state.midPrice, systemStock: entry.owned }, entry.itemType, policy);
            return {
                inventoryField: entry.inventoryField,
                mode: entry.mode,
                itemType: entry.itemType,
                category: entry.category,
                displayName: entry.displayName,
                icon: await resolveMarketIcon(entry.icon),
                owned: 0,
                systemStock: entry.owned,
                sellUnitPrice: current.sellUnitPrice,
                buyUnitPrice: current.buyUnitPrice,
                priceChangePercent: current.priceChangePercent,
                priceChangeDirection: current.priceChangeDirection,
                canBuy: policy.buyEnabled,
                canSell: false
            } satisfies IMarketEntry;
        })
    );
    const inventory = await Promise.all(playerEntries.map(async entry => ({
        inventoryField: entry.inventoryField,
        mode: entry.mode,
        itemType: entry.itemType,
        category: entry.category,
        displayName: entry.displayName,
        icon: await resolveMarketIcon(entry.icon),
        owned: entry.owned,
        canSell: policy.sellEnabled,
        canBuy: false
    })));
    return {
        enabled: true,
        policy: {
            accountDailyPlatinumCap: policy.accountDailyPlatinumCap,
            accountDailyTransactionLimit: policy.accountDailyTransactionLimit,
            accountDailyQuantityCap: policy.accountDailyQuantityCap,
            globalDailyMintCap: policy.globalDailyMintCap,
            globalDailyTransactionLimit: policy.globalDailyTransactionLimit,
            globalDailyQuantityCap: policy.globalDailyQuantityCap,
            minimumAccountAgeHours: policy.minimumAccountAgeHours
        },
        usage: {
            accountTradedPlatinum: accountCounter?.tradedPlatinum ?? 0,
            accountTransactions: accountCounter?.transactions ?? 0,
            accountQuantity: accountCounter?.quantity ?? 0,
            globalTradedPlatinum: globalCounter?.tradedPlatinum ?? 0,
            globalTransactions: globalCounter?.transactions ?? 0,
            globalQuantity: globalCounter?.quantity ?? 0
        },
        inventory,
        items
    };
};

export const tradePlayerMarket = async (account: TAccountDocument, side: TMarketAction, input: { inventoryField?: unknown; itemType?: unknown; mode?: unknown; quantity?: unknown; requestId?: unknown }): Promise<{ ledger: IPlayerMarketLedger; platinum: number }> => {
    await ensurePlayerMarketIndexes();
    const policy = playerMarketPolicy();
    if (!policy.enabled) throw new Error("market_disabled");
    if ((side == "buy" && !policy.buyEnabled) || (side == "sell" && !policy.sellEnabled)) throw new Error("market_side_disabled");
    if (Date.now() - account._id.getTimestamp().getTime() < policy.minimumAccountAgeHours * 3_600_000) throw new Error("market_account_too_new");
    if (!requestIdValid(input.requestId) || typeof input.inventoryField != "string" || typeof input.itemType != "string") throw new Error("invalid_market_request");
    if (input.mode != "stack" && input.mode != "instance") throw new Error("invalid_market_request");
    if (typeof input.quantity != "number" || !Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error("invalid_market_quantity");
    const inventoryField = input.inventoryField;
    const itemType = input.itemType;
    const mode = input.mode as TMarketMode;
    const requestId = input.requestId;
    const quantity = input.quantity;
    const existing = await PlayerMarketLedger.findOne({ accountId: account._id, requestId });
    if (existing) {
        if (existing.status != "completed") throw new Error("market_request_in_progress");
        const current = await Inventory.findOne({ accountOwnerId: account._id }, "PremiumCredits").lean();
        return { ledger: existing, platinum: current?.PremiumCredits ?? 0 };
    }
    if (!isTradeableField(inventoryField)) throw new Error("market_item_unavailable");
    const playerEntries = await entriesFor(account._id, false, policy, inventoryField, itemType, mode);
    const owned = mode == "stack" ? playerEntries.reduce((sum, entry) => sum + Number(entry.ItemCount ?? 0), 0) : playerEntries.length;
    const systemInventory = await getSystemInventory();
    const systemEntries = await entriesFor(undefined, true, policy, inventoryField, itemType, mode);
    const available = mode == "stack" ? systemEntries.reduce((sum, entry) => sum + Number(entry.ItemCount ?? 0), 0) : systemEntries.length;
    const state = await getState(inventoryField, itemType, mode, policy);
    if (state.systemStock != available) {
        state.systemStock = available;
        await PlayerMarketState.updateOne({ _id: state._id }, { $set: { systemStock: available, updatedAt: new Date() } });
    }
    const current = quote(state, itemType, policy);
    if (side == "sell" && owned < quantity) throw new Error("market_inventory_changed");
    if (side == "buy" && state.systemStock < quantity) throw new Error("market_stock_changed");
    const unitPrice = side == "sell" ? current.sellUnitPrice : current.buyUnitPrice;
    const totalPrice = quantity * unitPrice;
    const values = { tradedPlatinum: totalPrice, transactions: 1, quantity };
    const accountQuota = await reserveCounter(account._id.toString(), values, {
        tradedPlatinum: policy.accountDailyPlatinumCap,
        transactions: policy.accountDailyTransactionLimit,
        quantity: policy.accountDailyQuantityCap
    });
    if (!accountQuota) throw new Error("market_account_limit");
    const globalQuota = await reserveCounter("global", values, {
        tradedPlatinum: side == "sell" ? policy.globalDailyMintCap : Number.MAX_SAFE_INTEGER,
        transactions: policy.globalDailyTransactionLimit,
        quantity: policy.globalDailyQuantityCap
    });
    if (!globalQuota) {
        await releaseCounter(account._id.toString(), values);
        throw new Error("market_global_limit");
    }
    let ledger;
    try {
        ledger = await pendingLedger({ accountId: account._id, systemAccountId: systemInventory!._id, requestId, side, inventoryField, itemType, mode, quantity, unitPrice, totalPrice });
    } catch (error) {
        await releaseCounter(account._id.toString(), values);
        await releaseCounter("global", values);
        throw error;
    }
    let playerChanged = false;
    let systemChanged = false;
    let paymentChanged = false;
    let stockDelta = 0;
    const selectedSystemEntries = systemEntries.slice(0, quantity);
    let freeSpent = 0;
    try {
        if (side == "sell") {
            if (mode == "stack") playerChanged = await removeStack({ accountOwnerId: account._id }, inventoryField, itemType, quantity);
            else playerChanged = await removeInstances({ accountOwnerId: account._id }, inventoryField, playerEntries.slice(0, quantity));
            if (!playerChanged) throw new Error("market_inventory_changed");
            if (mode == "stack") systemChanged = await addStack(systemFilter, inventoryField, itemType, quantity);
            else systemChanged = await addInstances(systemFilter, inventoryField, playerEntries.slice(0, quantity));
            if (!systemChanged) throw new Error("market_system_inventory_unavailable");
            const payment = await Inventory.updateOne(
                { accountOwnerId: account._id, MarketRequestIds: { $ne: requestId } },
                { $inc: { PremiumCredits: totalPrice }, $addToSet: { MarketRequestIds: requestId } }
            );
            if (!payment.modifiedCount) throw new Error("market_inventory_unavailable");
            paymentChanged = true;
            await PlayerMarketState.updateOne({ _id: state._id }, { $inc: { systemStock: quantity }, $set: { updatedAt: new Date() } });
            stockDelta = quantity;
            await changeStatePrice(inventoryField, itemType, mode, side, quantity, policy);
            await completeLedger(ledger._id);
            ledger.status = "completed";
        } else {
            if (available < quantity) throw new Error("market_stock_changed");
            const buyer = await Inventory.findOne({ accountOwnerId: account._id }, "PremiumCredits PremiumCreditsFree").lean();
            if (!buyer || buyer.PremiumCredits < totalPrice) throw new Error("market_insufficient_funds");
            freeSpent = Math.min(buyer.PremiumCreditsFree, totalPrice);
            if (mode == "stack") systemChanged = await removeStack(systemFilter, inventoryField, itemType, quantity);
            else systemChanged = await removeInstances(systemFilter, inventoryField, selectedSystemEntries);
            if (!systemChanged) throw new Error("market_stock_changed");
            if (mode == "stack") playerChanged = await addStack({ accountOwnerId: account._id }, inventoryField, itemType, quantity);
            else playerChanged = await addInstances({ accountOwnerId: account._id }, inventoryField, selectedSystemEntries);
            if (!playerChanged) throw new Error("market_inventory_unavailable");
            const payment = await Inventory.updateOne({ accountOwnerId: account._id, PremiumCredits: { $gte: totalPrice }, MarketRequestIds: { $ne: requestId } }, { $inc: { PremiumCredits: -totalPrice, PremiumCreditsFree: -freeSpent }, $addToSet: { MarketRequestIds: requestId } });
            if (!payment.modifiedCount) throw new Error("market_insufficient_funds");
            paymentChanged = true;
            await PlayerMarketState.updateOne({ _id: state._id }, { $inc: { systemStock: -quantity }, $set: { updatedAt: new Date() } });
            stockDelta = -quantity;
            await changeStatePrice(inventoryField, itemType, mode, side, quantity, policy);
            await completeLedger(ledger._id);
            ledger.status = "completed";
        }
        const currentInventory = await Inventory.findOne({ accountOwnerId: account._id }, "PremiumCredits").lean();
        return { ledger, platinum: currentInventory?.PremiumCredits ?? 0 };
    } catch (error) {
        if (side == "sell") {
            if (systemChanged) {
                if (mode == "stack") await removeStack(systemFilter, inventoryField, itemType, quantity);
                else await removeInstances(systemFilter, inventoryField, playerEntries.slice(0, quantity));
            }
            if (playerChanged) {
                if (mode == "stack") await addStack({ accountOwnerId: account._id }, inventoryField, itemType, quantity);
                else await addInstances({ accountOwnerId: account._id }, inventoryField, playerEntries.slice(0, quantity));
            }
            if (paymentChanged) {
                await Inventory.updateOne(
                    { accountOwnerId: account._id, MarketRequestIds: requestId, PremiumCredits: { $gte: totalPrice } },
                    { $inc: { PremiumCredits: -totalPrice }, $pull: { MarketRequestIds: requestId } }
                );
            }
        } else {
            if (playerChanged) {
                if (mode == "stack") await removeStack({ accountOwnerId: account._id }, inventoryField, itemType, quantity);
                else await removeInstances({ accountOwnerId: account._id }, inventoryField, selectedSystemEntries);
            }
            if (systemChanged) {
                if (mode == "stack") await addStack(systemFilter, inventoryField, itemType, quantity);
                else await addInstances(systemFilter, inventoryField, selectedSystemEntries);
            }
            if (paymentChanged) {
                await Inventory.updateOne({ accountOwnerId: account._id, MarketRequestIds: requestId }, { $inc: { PremiumCredits: totalPrice, PremiumCreditsFree: freeSpent }, $pull: { MarketRequestIds: requestId } });
            }
        }
        if (stockDelta) {
            await PlayerMarketState.updateOne({ _id: state._id }, { $inc: { systemStock: -stockDelta }, $set: { updatedAt: new Date() } });
        }
        await deletePendingLedger(ledger._id);
        await releaseCounter(account._id.toString(), values);
        await releaseCounter("global", values);
        throw error;
    }
};

const deletePendingLedger = async (id: Types.ObjectId): Promise<void> => {
    await PlayerMarketLedger.deleteOne({ _id: id, status: "pending" });
};

export const getPlayerMarketConfig = (): IMarketPolicy => playerMarketPolicy();
