import type { Inventory } from "./api";
import { getInventoryCategoryForItem, inventoryCategories } from "./inventoryOverview";

export type InventoryRow = {
    key: string;
    type: string;
    name: string;
    category: string;
    categoryLabel: string;
    color: string;
    icon?: string;
    source: string;
    count: number;
    id?: string;
    xp?: number;
    polarized?: number;
    rank?: number;
};

const finiteNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

export const getInventoryRows = (
    inventory?: Inventory,
    names: Record<string, string> = {},
    icons: Record<string, string> = {}
): InventoryRow[] => {
    const rows: InventoryRow[] = [];
    for (const category of inventoryCategories) {
        for (const source of category.fields) {
            const items = inventory?.[source];
            if (!Array.isArray(items)) continue;
            items.forEach((item: unknown, index) => {
                if (!item || typeof item !== "object") return;
                const record = item as Record<string, unknown>;
                const type = typeof record.ItemType === "string" ? record.ItemType : "";
                if (!type) return;
                const itemCategory = getInventoryCategoryForItem(source, type);
                const itemId = record.ItemId;
                const id = typeof itemId === "string" ? itemId : itemId && typeof itemId === "object" && "$oid" in itemId && typeof itemId.$oid === "string" ? itemId.$oid : undefined;
                rows.push({
                    key: `${source}-${id ?? index}`,
                    type,
                    name: names[type] ?? (typeof record.ItemName === "string" && record.ItemName.trim() ? record.ItemName : type.split("/").filter(Boolean).at(-1) ?? type),
                    category: itemCategory.key,
                    categoryLabel: itemCategory.label,
                    color: itemCategory.color,
                    icon: icons[type],
                    source,
                    count: Math.max(0, finiteNumber(record.ItemCount) ?? 1),
                    id,
                    xp: finiteNumber(record.XP),
                    polarized: finiteNumber(record.Polarized),
                    rank: finiteNumber(record.Rank)
                });
            });
        }
    }
    return rows;
};
