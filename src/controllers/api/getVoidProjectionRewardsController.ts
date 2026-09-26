import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import { crackRelic, ensureRelicRewardIsCorrect } from "../../helpers/relicHelper.ts";
import { getInventory } from "../../services/inventoryService.ts";
import { getAccountForRequest } from "../../services/loginService.ts";
import { getAccountRateProfile, getEffectiveAccountRate } from "../../services/accountRateService.ts";
import type { IVoidTearParticipantInfo, IVoidTearWaveInfo } from "../../types/requestTypes.ts";
import type { RequestHandler } from "express";
import { logger } from "../../utils/logger.ts";

export const getVoidProjectionRewardsController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const accountId = account._id.toString();
    const data = getJSONfromString<IVoidProjectionRewardRequest | IVoidProjectionRewardsLegacyRequest>(
        String(req.body)
    );
    logger.debug(`getVoidProjectionRewards request:`, data);

    const currentWave = "CurrentWave" in data ? data.CurrentWave : data.VoidTearParticipantsCurrWave.Wave;
    const participantInfo =
        "ParticipantInfo" in data
            ? data.ParticipantInfo
            : data.VoidTearParticipantsCurrWave.Participants.find(p => p.AccountId == accountId);

    if (
        participantInfo &&
        participantInfo.QualifiesForReward &&
        !participantInfo.HaveRewardResponse &&
        !participantInfo.Reward
    ) {
        const inventory = await getInventory(accountId, undefined);
        const rates = getAccountRateProfile(account);
        const rewardMultiplier = getEffectiveAccountRate(rates, "relicRewardMultiplier");
        const platinumMultiplier = getEffectiveAccountRate(rates, "relicPlatinumMultiplier");
        const reward = await crackRelic(inventory, participantInfo, {}, rewardMultiplier, platinumMultiplier);
        if (!inventory.MissionRelicRewards || inventory.MissionRelicRewards.length >= currentWave) {
            inventory.MissionRelicRewards = [];
        }
        inventory.MissionRelicRewards.push({
            ItemType: reward.type,
            ItemCount: reward.itemCount,
            Rarity: reward.rarity
        });
        if (data.VoidTearParticipantsPrevWave) {
            await ensureRelicRewardIsCorrect(
                inventory,
                data.VoidTearParticipantsPrevWave,
                rewardMultiplier,
                platinumMultiplier
            );
        }
        await inventory.save();
    }

    if ("CurrentWave" in data) {
        res.json({
            CurrentWave: data.CurrentWave,
            ParticipantInfo: data.ParticipantInfo,
            DifficultyTier: data.DifficultyTier
        } satisfies IVoidProjectionRewardResponse);
    } else {
        res.json({
            VoidTearParticipantsCurrWave: data.VoidTearParticipantsCurrWave
        } satisfies IVoidProjectionRewardsLegacyResponse);
    }
};

interface IVoidProjectionRewardRequest {
    CurrentWave: number;
    ParticipantInfo: IVoidTearParticipantInfo;
    VoidTearParticipantsPrevWave?: IVoidTearWaveInfo;
    VoidTier: string;
    DifficultyTier: number;
    VoidProjectionRemovalHash: string;
}
interface IVoidProjectionRewardResponse {
    CurrentWave: number;
    ParticipantInfo: IVoidTearParticipantInfo;
    DifficultyTier: number;
}

// Legacy format seen in U27.3, unsure when it changed
interface IVoidProjectionRewardsLegacyRequest {
    VoidTearParticipantsCurrWave: IVoidTearWaveInfo;
    VoidTearParticipantsPrevWave?: IVoidTearWaveInfo;
    VoidTier: string;
    VoidProjectionRemovalHash: string;
}

interface IVoidProjectionRewardsLegacyResponse {
    VoidTearParticipantsCurrWave: IVoidTearWaveInfo;
}
