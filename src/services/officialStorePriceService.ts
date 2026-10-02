import {
    ExportBoosterPacks,
    ExportBundles,
    ExportCreditBundles,
    ExportCustoms,
    ExportGear,
    ExportRecipes,
    ExportResources,
    ExportSentinels,
    ExportWarframes,
    ExportWeapons
} from "warframe-public-export-plus";
import { BL_LATEST } from "../constants/gameVersions.ts";
import { StorePrice, type IStorePrice } from "../models/storePriceModel.ts";
import { getUndiscountedPrice, supplementalMarketPrices } from "./itemDataService.ts";
import { replaceOfficialStorePriceCache, type IOfficialStorePrice } from "./officialStorePriceCache.ts";

type PriceEntry = {
    excludeFromMarket?: boolean;
    platinumCost?: number;
    creditsCost?: number;
    components?: readonly unknown[];
};

const publicPriceTables: readonly Record<string, PriceEntry>[] = [
    ExportBoosterPacks,
    ExportBundles,
    ExportCreditBundles,
    ExportCustoms,
    ExportGear,
    ExportRecipes,
    ExportResources,
    ExportSentinels,
    ExportWarframes,
    ExportWeapons
] as readonly Record<string, PriceEntry>[];

const priceKey = (price: Pick<IOfficialStorePrice, "PremiumPrice" | "RegularPrice">): string =>
    `${price.PremiumPrice ?? ""}:${price.RegularPrice ?? ""}`;

const addPrice = (prices: Map<string, IOfficialStorePrice>, price: IOfficialStorePrice): void => {
    if (price.PremiumPrice === undefined && price.RegularPrice === undefined) return;
    const existing = prices.get(price.TypeName);
    if (!existing || priceKey(price) != priceKey(existing)) prices.set(price.TypeName, { ...existing, ...price });
};

const collectOfficialPrices = (): IOfficialStorePrice[] => {
    const prices = new Map<string, IOfficialStorePrice>();
    for (const table of publicPriceTables) {
        for (const [typeName, data] of Object.entries(table)) {
            if (data.excludeFromMarket === true) continue;
            let premiumPrice = data.platinumCost;
            let regularPrice = data.creditsCost;
            if (premiumPrice === undefined && regularPrice === undefined && data.components) {
                try {
                    premiumPrice = getUndiscountedPrice(typeName, 1, 0, true, BL_LATEST, true, true);
                    regularPrice = getUndiscountedPrice(typeName, 1, 0, false, BL_LATEST, true, true);
                } catch {
                    continue;
                }
            }
            addPrice(prices, { TypeName: typeName, PremiumPrice: premiumPrice, RegularPrice: regularPrice });
        }
    }
    for (const [typeName, premiumPrice] of Object.entries(supplementalMarketPrices)) {
        addPrice(prices, { TypeName: typeName, PremiumPrice: premiumPrice });
    }
    return [...prices.values()];
};

export interface IOfficialStorePriceSyncResult {
    total: number;
    created: number;
    updated: number;
    unchanged: number;
    deleted: number;
}

export const initializeOfficialStorePrices = async (): Promise<void> => {
    const prices = await StorePrice.find().lean();
    replaceOfficialStorePriceCache(prices);
};

export const listOfficialStorePrices = async (): Promise<IStorePrice[]> => {
    return StorePrice.find().sort({ TypeName: 1 }).lean();
};

export interface IOfficialStorePricePage {
    items: IStorePrice[];
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listOfficialStorePricePage = async (
    requestedPage = 1,
    requestedPageSize = 50,
    search = ""
): Promise<IOfficialStorePricePage> => {
    const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || 50, 10), 100);
    const filter = search.trim() ? { TypeName: { $regex: escapeRegExp(search.trim()), $options: "i" } } : {};
    const total = await StorePrice.countDocuments(filter);
    const pageCount = Math.ceil(total / pageSize);
    const page = Math.min(Math.max(Math.trunc(requestedPage) || 1, 1), Math.max(pageCount, 1));
    const items = await StorePrice.find(filter)
        .sort({ TypeName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();
    return { items, page, pageSize, pageCount, total };
};

export const saveSupplementalStorePrice = async (
    typeName: string,
    premiumPrice: number | undefined,
    regularPrice: number | undefined
): Promise<IStorePrice> => {
    const unset = {
        ...(premiumPrice === undefined ? { PremiumPrice: 1 } : {}),
        ...(regularPrice === undefined ? { RegularPrice: 1 } : {})
    };
    const saved = await StorePrice.findOneAndUpdate(
        { TypeName: typeName },
        {
            $set: {
                TypeName: typeName,
                ...(premiumPrice !== undefined ? { PremiumPrice: premiumPrice } : {}),
                ...(regularPrice !== undefined ? { RegularPrice: regularPrice } : {}),
                Source: "supplemental",
                SyncedAt: new Date()
            },
            $unset: unset
        },
        { upsert: true, returnDocument: "after", runValidators: true }
    ).lean();
    const prices = await StorePrice.find().lean();
    replaceOfficialStorePriceCache(prices);
    return saved!;
};

export const deleteSupplementalStorePrice = async (typeName: string): Promise<boolean> => {
    const result = await StorePrice.deleteOne({ TypeName: typeName, Source: "supplemental" });
    if (result.deletedCount > 0) replaceOfficialStorePriceCache(await StorePrice.find().lean());
    return result.deletedCount > 0;
};

export const syncOfficialStorePrices = async (): Promise<IOfficialStorePriceSyncResult> => {
    const prices = collectOfficialPrices();
    const existing = new Map((await StorePrice.find().lean()).map(price => [price.TypeName, price]));
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const syncedAt = new Date();
    const operations = prices.map(price => {
        const old = existing.get(price.TypeName);
        const sourceIsSupplemental = Object.hasOwn(supplementalMarketPrices, price.TypeName);
        if (!old) created++;
        else if (
            priceKey(price) != priceKey(old) ||
            old.Source != (sourceIsSupplemental ? "supplemental" : "public-export")
        )
            updated++;
        else unchanged++;
        const source: IStorePrice["Source"] = sourceIsSupplemental ? "supplemental" : "public-export";
        const unset: { PremiumPrice?: 1; RegularPrice?: 1 } = {};
        if (price.PremiumPrice === undefined) unset.PremiumPrice = 1;
        if (price.RegularPrice === undefined) unset.RegularPrice = 1;
        return {
            updateOne: {
                filter: { TypeName: price.TypeName },
                update: {
                    $set: { ...price, Source: source, SyncedAt: syncedAt },
                    $unset: unset
                },
                upsert: true
            }
        };
    });
    if (operations.length > 0) await StorePrice.bulkWrite(operations);
    const officialNames = new Set(prices.map(price => price.TypeName));
    const supplementalNames = [...existing.values()]
        .filter(price => price.Source == "supplemental" && !officialNames.has(price.TypeName))
        .map(price => price.TypeName);
    const retainedNames = [...officialNames, ...supplementalNames];
    const deletedResult = await StorePrice.deleteMany({ TypeName: { $nin: retainedNames } });
    replaceOfficialStorePriceCache(await StorePrice.find().lean());
    return { total: prices.length, created, updated, unchanged, deleted: deletedResult.deletedCount };
};
