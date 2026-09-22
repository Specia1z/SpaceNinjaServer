import { StoreOverride, type IStoreOverride } from "../models/storeOverrideModel.ts";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { toMongoDate2 } from "../helpers/inventoryHelpers.ts";

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
    const saved = await StoreOverride.findOneAndUpdate({ TypeName: override.TypeName }, override, {
        upsert: true,
        returnDocument: "after",
        runValidators: true
    }).lean();
    storeOverrides.set(saved!.TypeName, saved!);
    return saved!;
};

export const deleteStoreOverride = async (typeName: string): Promise<boolean> => {
    const result = await StoreOverride.deleteOne({ TypeName: typeName });
    storeOverrides.delete(typeName);
    return result.deletedCount > 0;
};

export const getActiveStoreOverride = (typeName: string): IStoreOverride | undefined => {
    const override = storeOverrides.get(typeName);
    return override && isActive(override) ? override : undefined;
};

export const isStoreItemListed = (typeName: string): boolean => {
    return getActiveStoreOverride(typeName)?.Listed !== false;
};

export const applyStoreOverrides = (worldState: IWorldState, buildLabel: string): void => {
    const now = Date.now();
    for (const override of storeOverrides.values()) {
        if (!isActive(override, now)) continue;
        worldState.FlashSales = worldState.FlashSales.filter(sale => sale.TypeName != override.TypeName);
        worldState.FlashSales.push({
            TypeName: override.TypeName,
            ShowInMarket: override.Listed || undefined,
            HideFromMarket: override.Listed ? undefined : true,
            Discount: override.DiscountPercent,
            // Absent unless the admin configured an absolute price, in which case it takes precedence over Discount.
            PremiumOverride: override.PremiumPrice,
            RegularOverride: override.RegularPrice,
            StartDate: toMongoDate2(override.StartDate ?? 0, buildLabel),
            EndDate: toMongoDate2(override.EndDate ?? 4_102_444_800_000, buildLabel)
        });
    }
};
