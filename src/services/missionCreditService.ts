import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IMissionCredits } from "../types/missionTypes.ts";
import { logger } from "../utils/logger.ts";
import { config } from "./configService.ts";
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
    creditMultiplier: number
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

    if (config.worldState?.creditBoostMultiplier) {
        inventory.RegularCredits += finalCredits.TotalCredits[1] * (config.worldState.creditBoostMultiplier - 1);
        finalCredits.TotalCredits[1] *= config.worldState.creditBoostMultiplier;
    }
    if (creditMultiplier != 1) {
        const multipliedCredits = Math.trunc(finalCredits.TotalCredits[1] * creditMultiplier);
        inventory.RegularCredits += multipliedCredits - finalCredits.TotalCredits[1];
        finalCredits.TotalCredits[1] = multipliedCredits;
    }
    const now = Math.trunc(Date.now() / 1000);
    if ((inventory.Boosters.find(x => x.ItemType == "/Lotus/Types/Boosters/CreditBooster")?.ExpiryDate ?? 0) > now) {
        inventory.RegularCredits += finalCredits.TotalCredits[1];
        finalCredits.TotalCredits[1] += finalCredits.TotalCredits[1];
    }
    if ((inventory.Boosters.find(x => x.ItemType == "/Lotus/Types/Boosters/CreditBlessing")?.ExpiryDate ?? 0) > now) {
        inventory.RegularCredits += finalCredits.TotalCredits[1] * 0.25;
        finalCredits.TotalCredits[1] += finalCredits.TotalCredits[1] * 0.25;
    }

    return finalCredits;
};
