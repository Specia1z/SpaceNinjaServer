import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IMissionCredits } from "../types/missionTypes.ts";
import { logger } from "../utils/logger.ts";
import { getWorldStateBoostMultiplier } from "./configService.ts";
import type { TAccountDocument } from "./loginService.ts";

export interface IMissionCreditSources {
    missionDropCredits: number;
    missionCompletionCredits: number;
    rngRewardCredits: number;
}

export const addMissionCredits = async (
    account: TAccountDocument,
    inventory: TInventoryDatabaseDocument,
    { missionDropCredits, missionCompletionCredits, rngRewardCredits }: IMissionCreditSources,
    creditMultiplier: number,
    clientBoostedDropCredits = false
): Promise<IMissionCredits> => {
    const finalCredits: IMissionCredits = {
        MissionCredits: [missionDropCredits, missionDropCredits],
        CreditsBonus: [missionCompletionCredits, missionCompletionCredits],
        TotalCredits: [0, 0]
    };

    const today = Math.trunc(Date.now() / 86400000) * 86400;
    if (account.DailyFirstWinDate != today) {
        account.DailyFirstWinDate = today;
        await account.save();
        logger.debug(`daily first win, doubling missionCompletionCredits (${missionCompletionCredits})`);
        finalCredits.DailyMissionBonus = true;
        inventory.RegularCredits += missionCompletionCredits;
        finalCredits.CreditsBonus[1] *= 2;
    }

    const totalCredits = finalCredits.MissionCredits[1] + finalCredits.CreditsBonus[1] + rngRewardCredits;
    finalCredits.TotalCredits = [totalCredits, totalCredits];

    const creditBoostMultiplier = getWorldStateBoostMultiplier("creditBoostMultiplier");
    if (creditBoostMultiplier) {
        inventory.RegularCredits += finalCredits.TotalCredits[1] * (creditBoostMultiplier - 1);
        finalCredits.TotalCredits[1] *= creditBoostMultiplier;
    }
    if (creditMultiplier != 1) {
        // Modern clients already applied the account world-state boost to cash they picked up.
        // Completion and RNG rewards are generated on the server and still need the account rate.
        const eligibleCredits = clientBoostedDropCredits
            ? (finalCredits.CreditsBonus[1] + rngRewardCredits) * (creditBoostMultiplier || 1)
            : finalCredits.TotalCredits[1];
        const extraCredits = Math.trunc(eligibleCredits * creditMultiplier) - eligibleCredits;
        inventory.RegularCredits += extraCredits;
        finalCredits.TotalCredits[1] += extraCredits;
    }
    const now = Math.trunc(Date.now() / 1000);
    const hasCreditBooster =
        (inventory.Boosters.find(x => x.ItemType == "/Lotus/Types/Boosters/CreditBooster")?.ExpiryDate ?? 0) > now;
    const hasCreditBlessing =
        (inventory.Boosters.find(x => x.ItemType == "/Lotus/Types/Boosters/CreditBlessing")?.ExpiryDate ?? 0) > now;
    if (hasCreditBooster) {
        inventory.RegularCredits += finalCredits.TotalCredits[1];
        finalCredits.TotalCredits[1] += finalCredits.TotalCredits[1];
    }
    if (hasCreditBlessing) {
        inventory.RegularCredits += finalCredits.TotalCredits[1] * 0.25;
        finalCredits.TotalCredits[1] += finalCredits.TotalCredits[1] * 0.25;
    }
    logger.debug("mission credit settlement", {
        account: account.DisplayName,
        missionDropCredits,
        missionCompletionCredits,
        rngRewardCredits,
        creditMultiplier,
        clientBoostedDropCredits,
        globalCreditMultiplier: creditBoostMultiplier || 1,
        hasCreditBooster,
        hasCreditBlessing,
        finalCredits: finalCredits.TotalCredits[1]
    });

    return finalCredits;
};
