import type { IStoreBundle } from "../models/storeBundleModel.ts";

export interface IOfficialStorePrice {
    TypeName: string;
    PremiumPrice?: number;
    RegularPrice?: number;
}

const officialPrices = new Map<string, IOfficialStorePrice>();
const storeBundles = new Map<string, IStoreBundle>();

export const replaceOfficialStorePriceCache = (prices: readonly IOfficialStorePrice[]): void => {
    officialPrices.clear();
    for (const price of prices) officialPrices.set(price.TypeName, price);
};

export const replaceStoreBundleCache = (bundles: readonly IStoreBundle[]): void => {
    storeBundles.clear();
    for (const bundle of bundles) storeBundles.set(bundle.TypeName, bundle);
};

export const getStoreItemLookupKeys = (storeItemName: string): string[] => {
    const keys = [storeItemName];
    if (storeItemName.startsWith("/Lotus/StoreItems/")) {
        const suffix = storeItemName.substring("/Lotus/StoreItems/".length);
        keys.push(`/Lotus/${suffix}`, `/Lotus/Types/StoreItems/${suffix}`);
    } else if (storeItemName.startsWith("/Lotus/Types/StoreItems/")) {
        const suffix = storeItemName.substring("/Lotus/Types/StoreItems/".length);
        keys.push(`/Lotus/StoreItems/${suffix}`, `/Lotus/${suffix}`);
    } else if (storeItemName.startsWith("/Lotus/")) {
        const suffix = storeItemName.substring("/Lotus/".length);
        keys.push(`/Lotus/StoreItems/${suffix}`, `/Lotus/Types/StoreItems/${suffix}`);
    }
    return keys;
};

export const getCachedOfficialStorePrice = (storeItemName: string, usePremium: boolean): number | undefined => {
    for (const key of getStoreItemLookupKeys(storeItemName)) {
        const price = officialPrices.get(key);
        const value = usePremium ? price?.PremiumPrice : price?.RegularPrice;
        if (value !== undefined) return value;
    }
    return undefined;
};

export const getCachedStoreBundle = (storeItemName: string): IStoreBundle | undefined => {
    for (const key of getStoreItemLookupKeys(storeItemName)) {
        const bundle = storeBundles.get(key);
        if (bundle) return bundle;
    }
    return undefined;
};
