import type { Inventory } from "./api";

export const inventoryCategories = [
    { key: "equipment", label: "战甲与载具", color: "#237b66", fields: ["Suits", "SpaceSuits", "MechSuits", "Hoverboards", "Motorcycles", "CrewShips", "CrewShipHarnesses"] },
    { key: "weapons", label: "武器", color: "#73aa99", fields: ["LongGuns", "Pistols", "Melee", "SpecialItems", "SentinelWeapons", "SpaceGuns", "SpaceMelee", "OperatorAmps", "DrifterGuns", "DrifterMelee", "DataKnives", "CrewShipWeapons", "CrewShipSalvagedWeapons"] },
    { key: "companions", label: "同伴", color: "#7f9fbf", fields: ["Sentinels", "KubrowPets", "MoaPets", "Horses"] },
    { key: "mods", label: "Mod", color: "#b29bc6", fields: ["RawUpgrades", "Upgrades"] },
    { key: "materials", label: "材料与资源", color: "#d4ae68", fields: ["MiscItems"] },
    { key: "cosmetics", label: "外观装饰", color: "#bc91aa", fields: ["OperatorSuits", "WeaponSkins"] },
    { key: "other", label: "其他物品", color: "#bbc5c1", fields: ["Recipes", "Consumables", "LevelKeys", "Antiques", "Scoops"] }
];

const cosmeticsCategory = inventoryCategories.find(category => category.key === "cosmetics")!;

export const getInventoryCategoryForItem = (source: string, type: string) => {
    if (
        source === "OperatorSuits" || source === "WeaponSkins" ||
        type.startsWith("/Lotus/Powersuits/Operator/") || type.startsWith("/Lotus/Upgrades/Skins/")
    ) return cosmeticsCategory;
    return inventoryCategories.find(category => category.fields.includes(source)) ?? inventoryCategories.find(category => category.key === "other")!;
};

/** Count item records only; mission, affiliation and loadout arrays are not possessions. */
export const getInventoryCategories = (inventory?: Inventory) => {
    const counts = new Map(inventoryCategories.map(category => [category.key, 0]));
    const sources = new Set(inventoryCategories.flatMap(category => category.fields));
    const aggregateQuantities = inventory?.scope === "allPlayers";
    for (const source of sources) {
        const items = inventory?.[source];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const type = typeof item.ItemType === "string" ? item.ItemType : "";
            const category = getInventoryCategoryForItem(source, type);
            const quantity = aggregateQuantities && typeof item.ItemCount === "number" ? Math.max(0, item.ItemCount) : 1;
            counts.set(category.key, (counts.get(category.key) ?? 0) + quantity);
        }
    }
    return inventoryCategories.map(category => ({ ...category, count: counts.get(category.key) ?? 0 }));
};

export const getTopInventoryItems = (inventory?: Inventory) => {
    const counts = new Map<string, number>();
    for (const item of inventory?.MiscItems ?? []) {
        const count = item.ItemCount ?? 1;
        if (typeof item.ItemType !== "string" || !Number.isFinite(count) || count <= 0) continue;
        counts.set(item.ItemType, (counts.get(item.ItemType) ?? 0) + count);
    }
    return [...counts].map(([type, count]) => ({
        type,
        count,
        label: type.split("/").filter(Boolean).at(-1) ?? type
    })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)).slice(0, 5);
};
