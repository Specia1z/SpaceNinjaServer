import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { logger } from "../utils/logger.ts";
import { config } from "./configService.ts";
import { getRandomInt } from "./rngService.ts";
import { createMessage } from "./inboxService.ts";

type MissionRewardState = {
    rewardDate?: Date;
    rewardToday?: number;
    pityCompletions?: number;
};

const rewardDayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.TZ ?? "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

const rewardDay = (date: Date): string => {
    const parts = Object.fromEntries(rewardDayFormatter.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const prepareMissionRewardState = (
    inventory: TInventoryDatabaseDocument,
    dateKey: "missionAyaRewardDate" | "missionPlatinumRewardDate",
    todayKey: "missionAyaRewardToday" | "missionPlatinumRewardToday",
    pityKey: "missionAyaRewardPity" | "missionPlatinumRewardPity"
): MissionRewardState => {
    const state = inventory as TInventoryDatabaseDocument & Record<string, Date | number | undefined>;
    const now = new Date();
    if (!state[dateKey] || rewardDay(state[dateKey] as Date) != rewardDay(now)) {
        state[dateKey] = now;
        state[todayKey] = 0;
    }
    return {
        rewardDate: state[dateKey] as Date,
        rewardToday: (state[todayKey] as number | undefined) ?? 0,
        pityCompletions: (state[pityKey] as number | undefined) ?? 0
    };
};

const commitMissionRewardState = (
    inventory: TInventoryDatabaseDocument,
    dateKey: "missionAyaRewardDate" | "missionPlatinumRewardDate",
    todayKey: "missionAyaRewardToday" | "missionPlatinumRewardToday",
    pityKey: "missionAyaRewardPity" | "missionPlatinumRewardPity",
    state: MissionRewardState,
    amount: number
): void => {
    const fields = inventory as TInventoryDatabaseDocument & Record<string, Date | number | undefined>;
    fields[dateKey] = state.rewardDate ?? new Date();
    fields[todayKey] = (state.rewardToday ?? 0) + amount;
    fields[pityKey] = amount > 0 ? 0 : (state.pityCompletions ?? 0) + 1;
};

const getMissionRewardAmount = ({
    inventory,
    min,
    max,
    chance,
    dailyCap,
    pityCompletions,
    multiplier,
    dateKey,
    todayKey,
    pityKey
}: {
    inventory: TInventoryDatabaseDocument;
    min: number;
    max: number;
    chance: number;
    dailyCap?: number;
    pityCompletions?: number;
    multiplier: number;
    dateKey: "missionAyaRewardDate" | "missionPlatinumRewardDate";
    todayKey: "missionAyaRewardToday" | "missionPlatinumRewardToday";
    pityKey: "missionAyaRewardPity" | "missionPlatinumRewardPity";
}): number => {
    const state = prepareMissionRewardState(inventory, dateKey, todayKey, pityKey);
    const nextPity = (state.pityCompletions ?? 0) + 1;
    const pityHit = pityCompletions !== undefined && pityCompletions > 0 && nextPity >= pityCompletions;
    if (max <= 0 || (dailyCap !== undefined && dailyCap <= (state.rewardToday ?? 0))) return 0;
    if (!pityHit && (chance <= 0 || (chance < 100 && Math.random() * 100 >= chance))) {
        const fields = inventory as TInventoryDatabaseDocument & Record<string, Date | number | undefined>;
        fields[pityKey] = nextPity;
        return 0;
    }
    const amount = Math.trunc(getRandomInt(min, max) * multiplier);
    const reward = dailyCap === undefined ? amount : Math.min(amount, dailyCap - (state.rewardToday ?? 0));
    commitMissionRewardState(inventory, dateKey, todayKey, pityKey, state, Math.max(0, reward));
    return Math.max(0, reward);
};

export const addMissionRegalAyaReward = async (
    inventory: TInventoryDatabaseDocument,
    missionAyaMultiplier = 1
): Promise<number> => {
    const amount = getMissionRewardAmount({
        inventory,
        min: Math.max(0, Math.trunc(config.missionAyaRewardMin ?? 1)),
        max: Math.max(0, Math.trunc(config.missionAyaRewardMax ?? 2)),
        chance: config.missionAyaRewardChance ?? 8,
        dailyCap: config.missionAyaRewardDailyCap ?? 3,
        pityCompletions: config.missionAyaRewardPityCompletions ?? 12,
        multiplier: missionAyaMultiplier,
        dateKey: "missionAyaRewardDate",
        todayKey: "missionAyaRewardToday",
        pityKey: "missionAyaRewardPity"
    });
    if (amount > 0) {
        await createMessage(inventory.accountOwnerId, [
            {
                sndr: "/Lotus/Language/Bosses/Ordis",
                msg: "/Lotus/Language/Inbox/FoundItemsBody",
                sub: "/Lotus/Language/Inbox/FoundItemsTitle",
                icon: "/Lotus/Interface/Icons/Npcs/Ordis.png",
                PrimeTokens: amount,
                highPriority: true
            }
        ]);
        logger.debug(`mission completion Regal Aya reward: ${amount} (sent by inbox)`);
    }
    return amount;
};

// Returns the directly credited amount; inbox deliveries are dispatched separately.
export const addMissionPlatinumReward = (
    inventory: TInventoryDatabaseDocument,
    missionPlatinumMultiplier: number
): number => {
    const amount = getMissionRewardAmount({
        inventory,
        min: Math.max(0, Math.trunc(config.missionPlatinumRewardMin ?? 1)),
        max: Math.max(0, Math.trunc(config.missionPlatinumRewardMax ?? 2)),
        chance: config.missionPlatinumRewardChance ?? 1,
        dailyCap: config.missionPlatinumRewardDailyCap ?? 2,
        pityCompletions: config.missionPlatinumRewardPityCompletions ?? 30,
        multiplier: missionPlatinumMultiplier,
        dateKey: "missionPlatinumRewardDate",
        todayKey: "missionPlatinumRewardToday",
        pityKey: "missionPlatinumRewardPity"
    });
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
