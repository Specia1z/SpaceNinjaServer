import { Types } from "mongoose";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { fromOid } from "../helpers/inventoryHelpers.ts";
import { logger } from "../utils/logger.ts";
import { createMessage } from "./inboxService.ts";
import { getInvasionByOid } from "./worldStateService.ts";
import { advanceLiveInvasionProgress } from "./liveWorldStateService.ts";
import { corpusDeathSquadInfo, grineerDeathSquadInfo } from "./invasionService.ts";

const normalizeInvasionDelta = (value: number): number => (Number.isFinite(value) ? Math.trunc(value) : 0);
const normalizeInvasionScore = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
const MAX_INVASION_CONTRIBUTION_KEYS = 256;

const getInvasionContributionKey = (
    inventoryUpdates: IMissionInventoryUpdateRequest,
    invasionId: string
): string | undefined => {
    const sharedSessionId =
        typeof inventoryUpdates.sharedSessionId == "string" ? inventoryUpdates.sharedSessionId.trim() : "";
    return sharedSessionId ? `${invasionId}|${sharedSessionId}` : undefined;
};

export const processInvasionProgress = async (
    inventory: TInventoryDatabaseDocument,
    inventoryUpdates: IMissionInventoryUpdateRequest
): Promise<void> => {
    const rewardInfo = inventoryUpdates.RewardInfo;
    const invasionProgress = inventoryUpdates.InvasionProgress;
    const canCreditInvasionProgress =
        inventoryUpdates.EndOfMatchUpload === true &&
        inventoryUpdates.MissionStatus == "GS_SUCCESS" &&
        rewardInfo !== undefined;
    if (!canCreditInvasionProgress || !invasionProgress) {
        logger.debug("ignoring invasion progress without a successful end-of-match reward");
        return;
    }

    for (const clientProgress of invasionProgress) {
        const invasionId = fromOid(clientProgress._id);
        const invasion = getInvasionByOid(invasionId);
        if (!invasion) {
            logger.warn(`received progress for unknown invasion ${invasionId}`);
            continue;
        }
        if (
            rewardInfo.node != invasion.Node ||
            (rewardInfo.invasionId !== undefined && rewardInfo.invasionId != invasionId)
        ) {
            logger.debug(`ignoring invasion progress for a mismatched mission: ${invasionId}`);
            continue;
        }

        const contributionKey = getInvasionContributionKey(inventoryUpdates, invasionId);
        if (contributionKey && inventory.InvasionContributionKeys?.includes(contributionKey)) {
            logger.debug(`ignoring replayed invasion progress for ${invasionId}`);
            continue;
        }

        const attackerScore = normalizeInvasionScore(clientProgress.AttackerScore);
        const defenderScore = normalizeInvasionScore(clientProgress.DefenderScore);
        if (attackerScore == defenderScore) {
            logger.debug(`ignoring invasion progress without a single winning faction: ${invasionId}`);
            continue;
        }
        const completionMultiplier = inventory.finishInvasionsInOneMission ? 3 : 1;
        // Scores are direction markers, not a client-controlled global progress amount.
        clientProgress.Delta = normalizeInvasionDelta(attackerScore > defenderScore ? 1 : -1);
        clientProgress.AttackerScore = attackerScore > defenderScore ? completionMultiplier : 0;
        clientProgress.DefenderScore = defenderScore > attackerScore ? completionMultiplier : 0;
        if (inventory.finishInvasionsInOneMission) {
            clientProgress.Delta *= completionMultiplier;
        }
        if (contributionKey) {
            inventory.InvasionContributionKeys ??= [];
            inventory.InvasionContributionKeys.push(contributionKey);
            if (inventory.InvasionContributionKeys.length > MAX_INVASION_CONTRIBUTION_KEYS) {
                inventory.InvasionContributionKeys.splice(
                    0,
                    inventory.InvasionContributionKeys.length - MAX_INVASION_CONTRIBUTION_KEYS
                );
            }
        }

        const dbProgress = inventory.QualifyingInvasions.find(x => x.invasionId.equals(invasionId));
        if (dbProgress) {
            dbProgress.Delta += clientProgress.Delta;
            dbProgress.AttackerScore += clientProgress.AttackerScore;
            dbProgress.DefenderScore += clientProgress.DefenderScore;
        } else {
            inventory.QualifyingInvasions.push({
                invasionId: new Types.ObjectId(invasionId),
                Delta: clientProgress.Delta,
                AttackerScore: clientProgress.AttackerScore,
                DefenderScore: clientProgress.DefenderScore
            });
        }

        await advanceLiveInvasionProgress(invasionId, clientProgress.AttackerScore, clientProgress.DefenderScore, 1);
        const factionSidedWith = clientProgress.AttackerScore ? invasion.Faction : invasion.DefenderFaction;
        if (invasion.Faction != "FC_INFESTATION") {
            const info = factionSidedWith != "FC_GRINEER" ? grineerDeathSquadInfo : corpusDeathSquadInfo;
            if (!inventory[info.booleanKey] && !inventory.noDeathMarks) {
                const numberKey = info.numberKey;
                inventory[numberKey] ??= 0;
                inventory[numberKey] += clientProgress.AttackerScore + clientProgress.DefenderScore;
                if (inventory[numberKey] >= 5) {
                    inventory[numberKey] = 0;
                    const isRepeatMark = inventory[info.booleanKey] !== undefined;
                    inventory[info.booleanKey] = true;
                    await createMessage(inventory.accountOwnerId, [
                        {
                            sndr: info.inboxSender,
                            msg: isRepeatMark ? info.inboxMessageRepeat : info.inboxMessage,
                            sub: info.inboxTitle,
                            icon: info.inboxIcon,
                            highPriority: true
                        }
                    ]);
                }
            }
        }
    }
};
