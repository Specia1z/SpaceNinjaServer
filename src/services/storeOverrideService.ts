import { StoreOverride, type IStoreOverride } from "../models/storeOverrideModel.ts";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { toMongoDate2 } from "../helpers/inventoryHelpers.ts";
import { fromStoreItem, getUndiscountedPrice, toStoreItem } from "./itemDataService.ts";
import { sendWsBroadcastToGame } from "./wsService.ts";

const storeOverrides = new Map<string, IStoreOverride>();
const permanentOfferStart = new Date(0);
const permanentOfferEnd = new Date("2100-01-01T00:00:00.000Z");
let priceSyncRunning = false;

const getOriginalPrice = (storeItem: string, usePremium: boolean, buildLabel: string): number | undefined => {
    try {
        return getUndiscountedPrice(storeItem, 1, 0, usePremium, buildLabel, true, true);
    } catch {
        return undefined;
    }
};

const isPromotionActive = (override: IStoreOverride, now: number = Date.now()): boolean => {
    return (
        override.Enabled &&
        (!override.StartDate || override.StartDate.getTime() <= now) &&
        (!override.EndDate || override.EndDate.getTime() > now) &&
        (!override.ProductExpiryDate || override.ProductExpiryDate.getTime() > now)
    );
};

const isCategoryActive = (override: IStoreOverride, now: number = Date.now()): boolean => {
    return (
        override.Enabled &&
        (!override.CategoryStartDate || override.CategoryStartDate.getTime() <= now) &&
        (!override.CategoryEndDate || override.CategoryEndDate.getTime() > now)
    );
};

const isProductWindowActive = (override: IStoreOverride, now: number = Date.now()): boolean => {
    return (
        override.Enabled &&
        (!override.StartDate || override.StartDate.getTime() <= now) &&
        (!override.ProductExpiryDate || override.ProductExpiryDate.getTime() > now)
    );
};

export const initializeStoreOverrides = async (): Promise<void> => {
    storeOverrides.clear();
    for (const override of await StoreOverride.find().lean()) {
        storeOverrides.set(overrideTypeName(override.TypeName), override);
    }
};

export const listStoreOverrides = async (): Promise<IStoreOverride[]> => {
    return StoreOverride.find().sort({ TypeName: 1 }).lean();
};

export interface IStorePriceSyncResult {
    total: number;
    updated: number;
    unchanged: number;
    unresolved: string[];
}

export const syncStoreOverridePrices = async (
    updatedBy: string,
    buildLabel: string
): Promise<IStorePriceSyncResult> => {
    if (priceSyncRunning) throw new Error("A store price synchronization is already running");
    priceSyncRunning = true;
    try {
        const overrides = await StoreOverride.find().lean();
        const unresolved: string[] = [];
        let updated = 0;
        let unchanged = 0;

        for (const override of overrides) {
            let premiumPrice: number | undefined;
            let regularPrice: number | undefined;
            try {
                const storeItem = storeItemName(override.TypeName);
                premiumPrice = getOriginalPrice(storeItem, true, buildLabel);
                regularPrice = getOriginalPrice(storeItem, false, buildLabel);
            } catch {
                unresolved.push(override.TypeName);
                continue;
            }
            const hasOfficialPrice = premiumPrice !== undefined || regularPrice !== undefined;
            const prices =
                override.DiscountPercent === undefined
                    ? {
                          ...(premiumPrice !== undefined ? { PremiumPrice: premiumPrice } : {}),
                          ...(regularPrice !== undefined ? { RegularPrice: regularPrice } : {})
                      }
                    : {};

            if (!hasOfficialPrice) {
                unresolved.push(override.TypeName);
                continue;
            }
            if (Object.keys(prices).length === 0) {
                unchanged++;
                continue;
            }

            const changed =
                (premiumPrice !== undefined && override.PremiumPrice !== premiumPrice) ||
                (regularPrice !== undefined && override.RegularPrice !== regularPrice);
            if (!changed) {
                unchanged++;
                continue;
            }

            await StoreOverride.updateOne(
                { TypeName: override.TypeName },
                { $set: { ...prices, UpdatedBy: updatedBy } },
                { runValidators: true }
            );
            storeOverrides.set(overrideTypeName(override.TypeName), {
                ...override,
                ...prices,
                UpdatedBy: updatedBy
            });
            updated++;
        }

        if (updated > 0) broadcastStoreRules();
        return { total: overrides.length, updated, unchanged, unresolved };
    } finally {
        priceSyncRunning = false;
    }
};

export const saveStoreOverride = async (override: IStoreOverride): Promise<IStoreOverride> => {
    const optionalKeys: (keyof IStoreOverride)[] = [
        "CategoryName",
        "Giftable",
        "PurchaseMode",
        "DiscountPercent",
        "PremiumPrice",
        "RegularPrice",
        "SupporterPack",
        "BogoBuy",
        "BogoGet",
        "Featured",
        "Popular",
        "BannerIndex",
        "CategoryStartDate",
        "CategoryEndDate",
        "ProductExpiryDate",
        "StartDate",
        "EndDate"
    ];
    const unset = Object.fromEntries(optionalKeys.filter(key => override[key] === undefined).map(key => [key, 1]));
    const saved = await StoreOverride.findOneAndUpdate(
        { TypeName: override.TypeName },
        {
            $set: Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined)),
            $unset: unset
        },
        {
            upsert: true,
            returnDocument: "after",
            runValidators: true
        }
    ).lean();
    storeOverrides.set(overrideTypeName(saved!.TypeName), saved!);
    broadcastStoreRules();
    return saved!;
};

export const deleteStoreOverride = async (typeName: string): Promise<boolean> => {
    const result = await StoreOverride.deleteOne({ TypeName: typeName });
    storeOverrides.delete(overrideTypeName(typeName));
    broadcastStoreRules();
    return result.deletedCount > 0;
};

const overrideTypeName = (typeName: string): string =>
    typeName.startsWith("/Lotus/StoreItems/") || typeName.startsWith("/Lotus/Types/StoreItems/")
        ? fromStoreItem(typeName)
        : typeName;

const storeItemName = (typeName: string): string =>
    typeName.startsWith("/Lotus/Types/StoreItems/") || typeName.startsWith("/Lotus/StoreItems/")
        ? typeName
        : toStoreItem(typeName);

export const getStoreItemRules = (): string => {
    const rules: Record<string, { giftable?: boolean; purchaseMode?: "platinum" | "steam" }> = {};
    for (const override of storeOverrides.values()) {
        if (!override.Enabled) continue;
        const giftable = override.Listed ? override.Giftable : false;
        if (giftable === undefined && !override.PurchaseMode) continue;
        rules[storeItemName(override.TypeName)] = {
            giftable,
            purchaseMode: override.PurchaseMode
        };
    }
    return JSON.stringify(rules);
};

const broadcastStoreRules = (): void => {
    sendWsBroadcastToGame(undefined, {
        sync_world_state: true,
        tunables_delta: { store_item_rules: getStoreItemRules() }
    });
};

export const getActiveStoreOverride = (typeName: string): IStoreOverride | undefined => {
    const override = storeOverrides.get(overrideTypeName(typeName));
    return override?.Enabled ? override : undefined;
};

export const getActiveStorePromotion = (typeName: string): IStoreOverride | undefined => {
    const override = getActiveStoreOverride(typeName);
    return override && isPromotionActive(override) ? override : undefined;
};

export const isStoreItemPurchasable = (typeName: string): boolean => {
    const override = getActiveStoreOverride(typeName);
    return override ? override.Listed && (override.Purchasable ?? true) : true;
};

export const isStoreItemGiftable = (typeName: string): boolean => {
    const override = getActiveStoreOverride(typeName);
    return override ? override.Listed && override.Giftable !== false : true;
};

export const applyStoreOverrides = (worldState: IWorldState, buildLabel: string): void => {
    const now = Date.now();
    for (const override of storeOverrides.values()) {
        if (!override.Enabled) continue;
        const storeItem = storeItemName(override.TypeName);
        const typeName = overrideTypeName(override.TypeName);
        const categories = worldState.InGameMarket.LandingPage.Categories;
        if (!override.Listed || override.CategoryName) {
            for (const category of categories) {
                if (category.Items) category.Items = category.Items.filter(item => item != storeItem);
            }
        }
        if (
            override.Listed &&
            isCategoryActive(override, now) &&
            !categories.some(category => category.Items?.includes(storeItem))
        ) {
            const category =
                categories.find(item => item.CategoryName == override.CategoryName) ??
                categories.find(item => item.CategoryName == "NEW");
            if (category) (category.Items ??= []).push(storeItem);
        }

        const hasFlashSaleOverride =
            !override.Listed ||
            override.DiscountPercent !== undefined ||
            override.PremiumPrice !== undefined ||
            override.RegularPrice !== undefined ||
            override.SupporterPack !== undefined ||
            override.BogoBuy !== undefined ||
            override.BogoGet !== undefined ||
            override.Featured !== undefined ||
            override.Popular !== undefined ||
            override.BannerIndex !== undefined ||
            override.ProductExpiryDate !== undefined ||
            override.StartDate !== undefined ||
            override.EndDate !== undefined;
        worldState.FlashSales = worldState.FlashSales.filter(sale => sale.TypeName != typeName);
        const promotionActive = isPromotionActive(override, now);
        const productWindowActive = override.ProductExpiryDate !== undefined && isProductWindowActive(override, now);
        if (
            !hasFlashSaleOverride ||
            (!promotionActive && !productWindowActive) ||
            (override.ProductExpiryDate !== undefined && !productWindowActive)
        )
            continue;

        const startDate = toMongoDate2(override.StartDate ?? permanentOfferStart, buildLabel);
        const endDate = toMongoDate2(
            promotionActive
                ? (override.EndDate ?? override.ProductExpiryDate ?? permanentOfferEnd)
                : (override.ProductExpiryDate ?? permanentOfferEnd),
            buildLabel
        );
        const productExpiryDate = override.ProductExpiryDate
            ? toMongoDate2(override.ProductExpiryDate, buildLabel)
            : undefined;
        const hasPriceOverride =
            override.DiscountPercent !== undefined ||
            override.PremiumPrice !== undefined ||
            override.RegularPrice !== undefined;
        const originalPremiumPrice =
            override.ProductExpiryDate !== undefined && !hasPriceOverride
                ? getOriginalPrice(storeItem, true, buildLabel)
                : undefined;
        const originalRegularPrice =
            override.ProductExpiryDate !== undefined && !hasPriceOverride
                ? getOriginalPrice(storeItem, false, buildLabel)
                : undefined;

        worldState.FlashSales.push({
            TypeName: typeName,
            ShowInMarket: override.Listed,
            HideFromMarket: override.Listed ? undefined : true,
            Discount: promotionActive ? override.DiscountPercent : undefined,
            // Absent unless the admin configured an absolute price, in which case it takes precedence over Discount.
            PremiumOverride: promotionActive ? (override.PremiumPrice ?? originalPremiumPrice) : originalPremiumPrice,
            RegularOverride: promotionActive ? (override.RegularPrice ?? originalRegularPrice) : originalRegularPrice,
            SupporterPack: promotionActive ? override.SupporterPack : undefined,
            BogoBuy: promotionActive ? override.BogoBuy : undefined,
            BogoGet: promotionActive ? override.BogoGet : undefined,
            Featured: promotionActive ? override.Featured : undefined,
            Popular: promotionActive ? override.Popular : undefined,
            BannerIndex: promotionActive ? override.BannerIndex : undefined,
            StartDate: startDate,
            EndDate: endDate,
            ...(productExpiryDate ? { ProductExpiryOverride: productExpiryDate } : {})
        });
    }
};
