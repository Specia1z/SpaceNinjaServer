import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IMission } from "../types/inventoryTypes/inventoryTypes.ts";

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
