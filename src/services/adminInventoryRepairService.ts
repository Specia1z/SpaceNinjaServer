import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";

export const MISCLASSIFIED_AUGMENT_ITEM = "/Lotus/Powersuits/Frost/IceShieldAugmentTwoCard";
export const ECHOES_HEX_CONQUEST_HARD_MODE_NODE = "EchoesHexConquestHardModeUnlocked";
export const ECHOES_HEX_CONQUEST_REPAIRED_SCORE = 27;
const ECHOES_HEX_CONQUEST_LEGACY_SCORE = 15;

export class InventoryRepairConflictError extends Error {
    constructor() {
        super("Inventory changed; preview the account again before repairing it");
        this.name = "InventoryRepairConflictError";
    }
}

export type TInventoryRepairPreview = {
    inventoryFound: boolean;
    itemType: string;
    affectedCount: number;
    suitSlotsToReturn: number;
};

export type THexConquestHardModeRepairPreview = {
    inventoryFound: boolean;
    currentScore: number;
    targetScore: number;
    unlockNodeCompleted: boolean;
};

const countMisclassifiedItems = (inventory: TInventoryDatabaseDocument): number =>
    inventory.Suits.filter(item => item.ItemType == MISCLASSIFIED_AUGMENT_ITEM).length;

export const previewMisclassifiedAugmentRepair = async (accountOwnerId: string): Promise<TInventoryRepairPreview> => {
    const inventory = await Inventory.findOne({ accountOwnerId });
    if (!inventory) {
        return {
            inventoryFound: false,
            itemType: MISCLASSIFIED_AUGMENT_ITEM,
            affectedCount: 0,
            suitSlotsToReturn: 0
        };
    }

    const affectedCount = countMisclassifiedItems(inventory);
    return {
        inventoryFound: true,
        itemType: MISCLASSIFIED_AUGMENT_ITEM,
        affectedCount,
        suitSlotsToReturn: affectedCount
    };
};

export const repairMisclassifiedAugmentInventory = async (
    accountOwnerId: string,
    expectedCount: number
): Promise<TInventoryRepairPreview> => {
    const inventory = await Inventory.findOne({ accountOwnerId });
    if (!inventory) throw new InventoryRepairConflictError();

    const affectedCount = countMisclassifiedItems(inventory);
    if (affectedCount != expectedCount || affectedCount == 0) {
        throw new InventoryRepairConflictError();
    }

    for (const suit of [...inventory.Suits]) {
        if (suit.ItemType == MISCLASSIFIED_AUGMENT_ITEM) inventory.Suits.pull(suit._id);
    }

    const existingUpgrade = inventory.RawUpgrades.find(item => item.ItemType == MISCLASSIFIED_AUGMENT_ITEM);
    if (existingUpgrade) {
        existingUpgrade.ItemCount += affectedCount;
    } else {
        inventory.RawUpgrades.push({ ItemType: MISCLASSIFIED_AUGMENT_ITEM, ItemCount: affectedCount });
    }

    inventory.SuitBin.Slots += affectedCount;
    inventory.increment();
    try {
        await inventory.save();
    } catch (error) {
        if (error instanceof Error && error.name == "VersionError") {
            throw new InventoryRepairConflictError();
        }
        throw error;
    }

    return {
        inventoryFound: true,
        itemType: MISCLASSIFIED_AUGMENT_ITEM,
        affectedCount,
        suitSlotsToReturn: affectedCount
    };
};

const getHexConquestRepairPreview = (inventory: TInventoryDatabaseDocument): THexConquestHardModeRepairPreview => ({
    inventoryFound: true,
    currentScore: inventory.EchoesHexConquestCacheScoreMission ?? 0,
    targetScore: ECHOES_HEX_CONQUEST_REPAIRED_SCORE,
    unlockNodeCompleted: inventory.NodeIntrosCompleted.includes(ECHOES_HEX_CONQUEST_HARD_MODE_NODE)
});

export const previewHexConquestHardModeRepair = async (
    accountOwnerId: string
): Promise<THexConquestHardModeRepairPreview> => {
    const inventory = await Inventory.findOne({ accountOwnerId });
    if (!inventory) {
        return {
            inventoryFound: false,
            currentScore: 0,
            targetScore: ECHOES_HEX_CONQUEST_REPAIRED_SCORE,
            unlockNodeCompleted: false
        };
    }
    return getHexConquestRepairPreview(inventory);
};

export const repairHexConquestHardMode = async (
    accountOwnerId: string,
    expectedScore: number
): Promise<THexConquestHardModeRepairPreview> => {
    const inventory = await Inventory.findOne({ accountOwnerId });
    if (!inventory) throw new InventoryRepairConflictError();

    const currentScore = inventory.EchoesHexConquestCacheScoreMission ?? 0;
    if (
        expectedScore != ECHOES_HEX_CONQUEST_LEGACY_SCORE ||
        currentScore != expectedScore ||
        inventory.NodeIntrosCompleted.includes(ECHOES_HEX_CONQUEST_HARD_MODE_NODE)
    ) {
        throw new InventoryRepairConflictError();
    }

    inventory.EchoesHexConquestCacheScoreMission = ECHOES_HEX_CONQUEST_REPAIRED_SCORE;
    inventory.NodeIntrosCompleted.push(ECHOES_HEX_CONQUEST_HARD_MODE_NODE);
    inventory.increment();
    try {
        await inventory.save();
    } catch (error) {
        if (error instanceof Error && error.name == "VersionError") {
            throw new InventoryRepairConflictError();
        }
        throw error;
    }

    return getHexConquestRepairPreview(inventory);
};
