export type Inventory = Record<string, unknown> & {
    scope?: "allPlayers";
    RegularCredits?: number;
    PremiumCredits?: number;
    FusionPoints?: number;
    PrimeTokens?: number;
    CrewShipFusionPoints?: number;
    MiscItems?: { ItemType: string; ItemCount?: number }[];
    Upgrades?: { ItemType: string; ItemId?: string; ItemCount?: number; UpgradeFingerprint?: string }[];
    RawUpgrades?: { ItemType: string; ItemCount?: number }[];
};

import { ACCOUNT_CHEAT_KEYS } from "./accountCheats";

export type ItemCatalog = {
    names: Record<string, string>;
    icons: Record<string, string>;
    items: CatalogItem[];
};

export type CatalogItem = {
    uniqueName: string;
    name: string;
    icon?: string;
    subtype?: string;
    category?: string;
    fusionLimit?: number;
};

const localizedItemNames: Record<string, string> = {
    "/Lotus/Powersuits/Operator/AdultOperatorSuitRemaster": "漂泊者外观",
    "/Lotus/Powersuits/Operator/ChildOperatorSuitRemaster": "指挥官外观"
};

const localizedItemIcons: Record<string, string> = {
    "/Lotus/Powersuits/Operator/AdultOperatorSuitRemaster": "/Lotus/Interface/Icons/Categories/IconOperator256.png",
    "/Lotus/Powersuits/Operator/ChildOperatorSuitRemaster": "/Lotus/Interface/Icons/Categories/IconOperatorHead256.png"
};

let itemNamesPromise: Promise<ItemCatalog> | undefined;

const loadItemNames = async (): Promise<ItemCatalog> => {
    const response = await fetch("/custom/getItemLists?lang=zh&gameVersion=latest");
    if (!response.ok) throw new Error("物品名称暂时无法加载");
    const lists = await response.json() as Record<string, unknown>;
    const names: Record<string, string> = { ...localizedItemNames };
    const icons: Record<string, string> = { ...localizedItemIcons };
    const items = new Map<string, CatalogItem>();
    for (const [key, list] of Object.entries(lists)) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (item && typeof item.uniqueName === "string") {
                if (typeof item.name === "string" && !names[item.uniqueName]) names[item.uniqueName] = item.name;
                if (typeof item.icon === "string" && !icons[item.uniqueName]) icons[item.uniqueName] = item.icon;
                const existing = items.get(item.uniqueName);
                if (typeof item.name === "string" && !existing) {
                    items.set(item.uniqueName, {
                        uniqueName: item.uniqueName,
                        name: item.name,
                        icon: typeof item.icon === "string" ? item.icon : undefined,
                        subtype: typeof item.subtype === "string" ? item.subtype : undefined,
                        category: key,
                        fusionLimit: typeof item.fusionLimit === "number" ? item.fusionLimit : undefined
                    });
                } else if (existing) {
                    if (key === "mods") existing.category = "mods";
                    existing.icon ??= typeof item.icon === "string" ? item.icon : undefined;
                    existing.subtype ??= typeof item.subtype === "string" ? item.subtype : undefined;
                    existing.fusionLimit ??= typeof item.fusionLimit === "number" ? item.fusionLimit : undefined;
                }
            }
        }
    }
    for (const [uniqueName, name] of Object.entries(localizedItemNames)) {
        if (!items.has(uniqueName)) items.set(uniqueName, { uniqueName, name, icon: localizedItemIcons[uniqueName] });
    }
    return { names, icons, items: [...items.values()] };
};

export const getItemCatalog = (): Promise<ItemCatalog> => {
    itemNamesPromise ??= loadItemNames().catch(error => {
        itemNamesPromise = undefined;
        throw error;
    });
    return itemNamesPromise;
};

const getAuthUrl = (authz: string, path: string): string => `${path}${path.includes("?") ? "&" : "?"}${authz}`;

export const request = async <T>(path: string, authz: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(getAuthUrl(authz, path), {
        ...init,
        headers: {
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...init?.headers
        }
    });
    if (!response.ok) {
        throw new Error((await response.text()) || `Request failed: ${response.status}`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
};

export const getInventory = (authz: string): Promise<Inventory> =>
    request<Inventory>("/api/inventory.php", `${authz}&xpBasedLevelCapDisabled=1`);

export type AdminOverviewResponse = {
    scope: "allPlayers";
    generatedAt: string;
    players: {
        total: number;
        active: number;
        banned: number;
        withInventory: number;
    };
    inventory: Inventory;
    stats: {
        inventoryRecords: number;
        inventoryQuantity: number;
        uniqueItemTypes: number;
        totalModInstances: number;
        uniqueModTypes: number;
        totalRawMods: number;
        uniqueRawModTypes: number;
    };
};

export const getAdminOverview = (authz: string): Promise<AdminOverviewResponse> =>
    request<AdminOverviewResponse>("/custom/admin/overview", authz);

export const addCurrency = (authz: string, currency: string, delta: number): Promise<unknown> =>
    request("/custom/addCurrency", authz, {
        method: "POST",
        body: JSON.stringify({ currency, delta })
    });

export const addItems = (authz: string, itemType: string, itemCount: number, fingerprint?: string): Promise<unknown> =>
    request("/custom/addItems", authz, {
        method: "POST",
        body: JSON.stringify([{ ItemType: itemType, ItemCount: itemCount, ...(fingerprint ? { Fingerprint: fingerprint } : {}) }])
    });

export type ItemGrant = { ItemType: string; ItemCount: number; Fingerprint?: string };

export const addItemsBatch = (authz: string, items: ItemGrant[]): Promise<unknown> =>
    request("/custom/addItems", authz, {
        method: "POST",
        body: JSON.stringify(items)
    });

export const updateModFingerprint = (
    authz: string,
    oid: string,
    upgradeFingerprint: Record<string, unknown>
): Promise<unknown> =>
    request("/custom/updateFingerprint", authz, {
        method: "POST",
        body: JSON.stringify({ category: "Upgrades", oid, action: "set", upgradeFingerprint })
    });

export type ManagedAccountInventory = Inventory & {
    accountId: string;
    displayName: string;
};

export const getManagedAccountInventory = (authz: string, accountId: string): Promise<ManagedAccountInventory> =>
    request<ManagedAccountInventory>(`/custom/admin/account-inventory?targetAccountId=${encodeURIComponent(accountId)}`, authz);

export const updateManagedAccountMod = (
    authz: string,
    accountId: string,
    oid: string,
    upgradeFingerprint: Record<string, unknown>
): Promise<void> =>
    request<void>("/custom/admin/account-inventory", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, action: "updateFingerprint", oid, fingerprint: upgradeFingerprint })
    });

export const addManagedAccountMod = (
    authz: string,
    accountId: string,
    itemType: string,
    itemCount: number,
    fingerprint?: string
): Promise<void> =>
    request<void>("/custom/admin/account-inventory", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, action: "grant", itemType, itemCount, fingerprint })
    });

export const addManagedAccountCurrency = (
    authz: string,
    accountId: string,
    currency: string,
    delta: number
): Promise<void> =>
    request<void>("/custom/admin/account-inventory", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, action: "addCurrency", currency, delta })
    });

export const addManagedAccountItems = (
    authz: string,
    accountId: string,
    items: ItemGrant[]
): Promise<void> =>
    request<void>("/custom/admin/account-inventory/mod", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, action: "grantItems", items })
    });

export const deleteManagedAccountMod = (
    authz: string,
    accountId: string,
    mod: { oid?: string; itemType?: string; itemCount?: number }
): Promise<void> =>
    request<void>("/custom/admin/account-inventory", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, action: "deleteMod", ...mod })
    });

export const deleteManagedAccountInventoryItem = (
    authz: string,
    accountId: string,
    item: { source: string; itemType: string; itemId?: string; itemCount: number }
): Promise<void> =>
    request<void>("/custom/admin/account-inventory", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, action: "deleteItem", ...item })
    });

export const getAdminConfig = (authz: string): Promise<Record<string, unknown> | null> =>
    request<Record<string, unknown> | null>("/custom/getConfig", authz, {
        method: "POST",
        body: JSON.stringify(["worldState.liveSync", "worldState.invasionMode", ...ACCOUNT_CHEAT_KEYS])
    });

export type AccountRatesResponse = {
    definitions: { key: string; labelKey: string; group: string; min: number; max: number; step: number }[];
    featureDefinitions: { key: string; labelKey: string }[];
    accounts: {
        id: string;
        displayName: string;
        banned: boolean;
        profile: Record<string, number | boolean | string | undefined>;
        featureProfile: Record<string, boolean>;
        hasCustomProfile: boolean;
        hasCustomFeatures: boolean;
    }[];
};

export const getAccountRates = (authz: string): Promise<AccountRatesResponse> =>
    request<AccountRatesResponse>("/custom/admin/account-rates", authz);

export const saveAccountRates = (
    authz: string,
    accountId: string,
    profile: Record<string, number | boolean | string | undefined>
): Promise<{
    id: string;
    displayName: string;
    profile: Record<string, number | boolean | string | undefined>;
    featureProfile: Record<string, boolean>;
    hasCustomFeatures: boolean;
}> =>
    request("/custom/admin/account-rates", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, profile })
    });

export const saveAccountFeatures = (
    authz: string,
    accountId: string,
    features: Record<string, boolean>
): Promise<{
    id: string;
    displayName: string;
    profile: Record<string, number | boolean | string | undefined>;
    featureProfile: Record<string, boolean>;
    hasCustomFeatures: boolean;
}> =>
    request("/custom/admin/account-rates", authz, {
        method: "POST",
        body: JSON.stringify({ accountId, features })
    });

export const deleteAccountRates = (authz: string, accountId: string): Promise<void> =>
    request<void>("/custom/admin/account-rates/delete", authz, {
        method: "POST",
        body: JSON.stringify({ accountId })
    });

export const setManagedAccountBan = (authz: string, accountId: string, banned: boolean): Promise<{ Banned: boolean }> =>
    request<{ Banned: boolean }>("/custom/admin/suspicion-events/ban", authz, {
        method: "POST",
        body: JSON.stringify({ AccountId: accountId, Banned: banned })
    });

export const setAdminConfig = (authz: string, edits: Record<string, boolean | string | number | null>): Promise<void> =>
    request<void>("/custom/setConfig", authz, {
        method: "POST",
        body: JSON.stringify(edits)
    });
