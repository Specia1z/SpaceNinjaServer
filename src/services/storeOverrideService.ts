import { StoreOverride, type IStoreOverride } from "../models/storeOverrideModel.ts";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { toMongoDate2 } from "../helpers/inventoryHelpers.ts";
import { toStoreItem } from "./itemDataService.ts";
import { sendWsBroadcastToGame } from "./wsService.ts";

const storeOverrides = new Map<string, IStoreOverride>();

const isActive = (override: IStoreOverride, now: number = Date.now()): boolean => {
    return (
        override.Enabled &&
        (!override.StartDate || override.StartDate.getTime() <= now) &&
        (!override.EndDate || override.EndDate.getTime() > now)
    );
};

export const initializeStoreOverrides = async (): Promise<void> => {
    storeOverrides.clear();
    for (const override of await StoreOverride.find().lean()) {
        storeOverrides.set(override.TypeName, override);
    }
};

export const listStoreOverrides = async (): Promise<IStoreOverride[]> => {
    return StoreOverride.find().sort({ TypeName: 1 }).lean();
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
    storeOverrides.set(saved!.TypeName, saved!);
    broadcastStoreRules();
    return saved!;
};

export const deleteStoreOverride = async (typeName: string): Promise<boolean> => {
    const result = await StoreOverride.deleteOne({ TypeName: typeName });
    storeOverrides.delete(typeName);
    broadcastStoreRules();
    return result.deletedCount > 0;
};

const storeItemName = (typeName: string): string =>
    typeName.startsWith("/Lotus/Types/StoreItems/") || typeName.startsWith("/Lotus/StoreItems/")
        ? typeName
        : toStoreItem(typeName);

export const getStoreItemRules = (): string => {
    const rules: Record<string, { giftable?: boolean; purchaseMode?: "platinum" | "steam" }> = {};
    for (const override of storeOverrides.values()) {
        if (!isActive(override) || (override.Giftable === undefined && !override.PurchaseMode)) continue;
        rules[storeItemName(override.TypeName)] = {
            giftable: override.Giftable,
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
    const override = storeOverrides.get(typeName);
    return override && isActive(override) ? override : undefined;
};

export const isStoreItemPurchasable = (typeName: string): boolean => {
    const override = getActiveStoreOverride(typeName);
    return override ? (override.Purchasable ?? override.Listed) : true;
};

export const isStoreItemGiftable = (typeName: string): boolean => {
    const override = getActiveStoreOverride(typeName);
    return override?.Giftable !== false;
};

export const applyStoreOverrides = (worldState: IWorldState, buildLabel: string): void => {
    const now = Date.now();
    for (const override of storeOverrides.values()) {
        if (!isActive(override, now)) continue;
        const storeItem = storeItemName(override.TypeName);
        const categories = worldState.InGameMarket.LandingPage.Categories;
        if (!override.Listed || override.CategoryName) {
            for (const category of categories) {
                if (category.Items) category.Items = category.Items.filter(item => item != storeItem);
            }
        }
        if (override.Listed && !categories.some(category => category.Items?.includes(storeItem))) {
            const category =
                categories.find(item => item.CategoryName == override.CategoryName) ??
                categories.find(item => item.CategoryName == "NEW");
            if (category) (category.Items ??= []).push(storeItem);
        }
        worldState.FlashSales = worldState.FlashSales.filter(sale => sale.TypeName != override.TypeName);
        worldState.FlashSales.push({
            TypeName: override.TypeName,
            ShowInMarket: override.Listed,
            HideFromMarket: override.Listed ? undefined : true,
            Discount:
                override.DiscountPercent ??
                (override.PremiumPrice === undefined && override.RegularPrice === undefined ? 0 : undefined),
            // Absent unless the admin configured an absolute price, in which case it takes precedence over Discount.
            PremiumOverride: override.PremiumPrice,
            RegularOverride: override.RegularPrice,
            SupporterPack: override.SupporterPack,
            BogoBuy: override.BogoBuy,
            BogoGet: override.BogoGet,
            Featured: override.Featured,
            Popular: override.Popular,
            BannerIndex: override.BannerIndex,
            StartDate: toMongoDate2(override.StartDate ?? 0, buildLabel),
            EndDate: toMongoDate2(override.EndDate ?? 4_102_444_800_000, buildLabel),
            ProductExpiryOverride: toMongoDate2(override.EndDate ?? 4_102_444_800_000, buildLabel)
        });
    }
};
