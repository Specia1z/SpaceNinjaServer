import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { logger } from "../utils/logger.ts";
import { config } from "./configService.ts";
import { getRandomInt } from "./rngService.ts";

// Returns the directly credited amount; inbox deliveries are dispatched separately.
export const addMissionPlatinumReward = (
    inventory: TInventoryDatabaseDocument,
    missionPlatinumMultiplier: number
): number => {
    const min = Math.max(0, Math.trunc(config.missionPlatinumRewardMin ?? 0));
    const max = Math.max(min, Math.trunc(config.missionPlatinumRewardMax ?? min));
    if (max == 0) return 0;

    const chance = config.missionPlatinumRewardChance ?? 100;
    if (chance <= 0 || (chance < 100 && Math.random() * 100 >= chance)) {
        logger.debug(`mission completion platinum reward skipped by chance (${chance}%)`);
        return 0;
    }

    const amount = Math.trunc(getRandomInt(min, max) * missionPlatinumMultiplier);
    if (amount <= 0) return 0;

    if (!config.missionPlatinumRewardSendMail) {
        inventory.PremiumCredits += amount;
        logger.debug(`mission completion platinum reward: ${amount} (credited directly)`);
        return amount;
    }

    inventory.pendingPremiumCredits = (inventory.pendingPremiumCredits ?? 0) + amount;
    logger.debug(`mission completion platinum reward: ${amount} (queued for inbox)`);
    return 0;
};
