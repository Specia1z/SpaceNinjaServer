import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { ILoreFragmentScan, IMission } from "../types/inventoryTypes/inventoryTypes.ts";

export const addFocusXpIncreases = (inventory: TInventoryDatabaseDocument, focusXpPlus: number[]): void => {
    const focusTypes = {
        AP_ATTACK: 1,
        AP_DEFENSE: 2,
        AP_TACTIC: 3,
        AP_POWER: 4,
        AP_WARD: 7
    } as const;
    inventory.FocusXP ??= {};
    for (const [name, index] of Object.entries(focusTypes)) {
        const amount = focusXpPlus[index];
        if (amount) {
            const key = name as keyof typeof inventory.FocusXP;
            inventory.FocusXP[key] ??= 0;
            inventory.FocusXP[key]! += amount;
        }
    }
    if (!inventory.noDailyFocusLimit) inventory.DailyFocus -= focusXpPlus.reduce((sum, value) => sum + value, 0);
};

export const addLoreFragmentScans = (inventory: TInventoryDatabaseDocument, scans: ILoreFragmentScan[]): void => {
    scans.forEach(scan => {
        const fragment = inventory.LoreFragmentScans.find(item => item.ItemType == scan.ItemType);
        if (fragment) fragment.Progress += scan.Progress;
        else inventory.LoreFragmentScans.push(scan);
    });
};

export const addMissionComplete = (
    inventory: Pick<TInventoryDatabaseDocument, "Missions">,
    { Tag, Completes, Tier }: IMission
): void => {
    const itemIndex = inventory.Missions.findIndex(item => item.Tag === Tag);
    if (itemIndex !== -1) {
        inventory.Missions[itemIndex].Completes += Completes;
        if (Completes && Tier) inventory.Missions[itemIndex].Tier = Tier;
    } else if (Tag !== "") {
        inventory.Missions.push({ Tag, Completes });
    }
};

export const addBooster = (itemType: string, timeSecs: number, inventory: TInventoryDatabaseDocument): void => {
    const currentTime = Math.floor(Date.now() / 1000);
    const itemIndex = inventory.Boosters.findIndex(booster => booster.ItemType === itemType);
    if (itemIndex !== -1) {
        const existingBooster = inventory.Boosters[itemIndex];
        existingBooster.ExpiryDate = Math.max(existingBooster.ExpiryDate, currentTime) + timeSecs;
    } else {
        inventory.Boosters.push({ ItemType: itemType, ExpiryDate: currentTime + timeSecs });
    }
};

export const setBooster = (itemType: string, expiryTimeSecs: number, inventory: TInventoryDatabaseDocument): void => {
    const itemIndex = inventory.Boosters.findIndex(booster => booster.ItemType === itemType);
    if (itemIndex !== -1) {
        const existingBooster = inventory.Boosters[itemIndex];
        existingBooster.ExpiryDate = Math.max(existingBooster.ExpiryDate, expiryTimeSecs);
    } else {
        inventory.Boosters.push({ ItemType: itemType, ExpiryDate: expiryTimeSecs });
    }
};
