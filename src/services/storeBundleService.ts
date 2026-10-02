import { ExportBundles } from "warframe-public-export-plus";
import type { IBundle } from "warframe-public-export-plus";
import { StoreBundle, type IStoreBundle, type IStoreBundleComponent } from "../models/storeBundleModel.ts";
import { getAdminItemData } from "./adminItemDataService.ts";
import { supplementalBundles, toStoreItem } from "./itemDataService.ts";
import { replaceStoreBundleCache } from "./officialStorePriceCache.ts";

export interface IStoreBundleListItem {
    TypeName: string;
    Components: IStoreBundleComponent[];
    Source: "public-export" | "supplemental";
    Editable: boolean;
}

export interface IStoreBundlePage {
    items: IStoreBundleListItem[];
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
}

const normalizeTypeName = (typeName: string): string => {
    if (typeName.startsWith("/Lotus/Types/StoreItems/")) return typeName;
    if (typeName.startsWith("/Lotus/StoreItems/")) {
        return "/Lotus/Types/StoreItems/" + typeName.substring("/Lotus/StoreItems/".length);
    }
    throw new Error("Bundle TypeName must be a StoreItem path");
};

const normalizeComponents = (components: readonly IStoreBundleComponent[]): IStoreBundleComponent[] => {
    if (components.length == 0 || components.length > 100) throw new Error("A bundle must contain 1 to 100 components");
    return components.map(component => {
        if (
            typeof component.TypeName != "string" ||
            !component.TypeName.startsWith("/Lotus/") ||
            component.TypeName.length > 300
        ) {
            throw new Error("Invalid bundle component TypeName");
        }
        if (
            !Number.isInteger(component.PurchaseQuantity) ||
            component.PurchaseQuantity < 1 ||
            component.PurchaseQuantity > 100
        ) {
            throw new Error("Invalid bundle component quantity");
        }
        if (
            component.DurabilityDays !== undefined &&
            (!Number.isInteger(component.DurabilityDays) || ![3, 7, 30, 90].includes(component.DurabilityDays))
        ) {
            throw new Error("Invalid bundle component duration");
        }
        return {
            TypeName: toStoreItem(component.TypeName),
            PurchaseQuantity: component.PurchaseQuantity,
            ...(component.DurabilityDays !== undefined ? { DurabilityDays: component.DurabilityDays } : {})
        };
    });
};

export const initializeStoreBundles = async (): Promise<void> => {
    replaceStoreBundleCache(await StoreBundle.find().lean());
};

export const listStoreBundles = async (): Promise<IStoreBundleListItem[]> => {
    const custom = await StoreBundle.find().sort({ TypeName: 1 }).lean();
    const customByTypeName = new Map(custom.map(bundle => [bundle.TypeName, bundle]));
    const builtIn = new Map<string, { bundle: IBundle; Source: IStoreBundleListItem["Source"] }>();
    for (const [TypeName, bundle] of Object.entries(ExportBundles)) {
        builtIn.set(TypeName, { bundle, Source: "public-export" });
    }
    for (const [TypeName, bundle] of Object.entries(supplementalBundles)) {
        builtIn.set(TypeName, { bundle, Source: "supplemental" });
    }
    for (const [TypeName, bundle] of Object.entries((await getAdminItemData("en")).bundles)) {
        builtIn.set(TypeName, { bundle, Source: "public-export" });
    }
    const official = [...builtIn.entries()]
        .filter(([TypeName]) => !customByTypeName.has(TypeName))
        .map(([TypeName, { bundle, Source }]) => ({
            TypeName,
            Components: bundle.components.map(component => ({
                TypeName: component.typeName,
                PurchaseQuantity: component.purchaseQuantity,
                ...(component.durabilityDays !== undefined ? { DurabilityDays: component.durabilityDays } : {})
            })),
            Source,
            Editable: false
        }));
    return [
        ...custom.map(bundle => ({ ...bundle, Source: "supplemental" as const, Editable: true })),
        ...official
    ].sort((left, right) => left.TypeName.localeCompare(right.TypeName));
};

export const listStoreBundlePage = async (requestedPage = 1, requestedPageSize = 25): Promise<IStoreBundlePage> => {
    const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || 25, 10), 100);
    const bundles = await listStoreBundles();
    const total = bundles.length;
    const pageCount = Math.ceil(total / pageSize);
    const page = Math.min(Math.max(Math.trunc(requestedPage) || 1, 1), Math.max(pageCount, 1));
    const items = bundles.slice((page - 1) * pageSize, page * pageSize);
    return { items, page, pageSize, pageCount, total };
};

export const saveStoreBundle = async (
    typeName: string,
    components: readonly IStoreBundleComponent[]
): Promise<IStoreBundle> => {
    const normalized = {
        TypeName: normalizeTypeName(typeName),
        Components: normalizeComponents(components)
    };
    const saved = await StoreBundle.findOneAndUpdate(
        { TypeName: normalized.TypeName },
        { $set: normalized },
        { upsert: true, returnDocument: "after", runValidators: true }
    ).lean();
    replaceStoreBundleCache(await StoreBundle.find().lean());
    return saved!;
};

export const deleteStoreBundle = async (typeName: string): Promise<boolean> => {
    const result = await StoreBundle.deleteOne({ TypeName: normalizeTypeName(typeName) });
    if (result.deletedCount > 0) replaceStoreBundleCache(await StoreBundle.find().lean());
    return result.deletedCount > 0;
};
