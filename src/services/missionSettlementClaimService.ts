import crypto from "node:crypto";
import type { Types } from "mongoose";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import { MissionSettlementClaim } from "../models/missionSettlementClaimModel.ts";

const CLAIM_LEASE_MS = 5 * 60_000;

type TMissionSettlementIdentity = Pick<
    IMissionInventoryUpdateRequest,
    "sharedSessionId" | "MissionPTS" | "RepHash" | "EndOfMatchUpload" | "RJ" | "Missions" | "RewardInfo"
>;

export type TMissionSettlementClaimResult =
    | { status: "claimed"; claimId: Types.ObjectId; claimToken: string }
    | { status: "busy" }
    | { status: "completed" };

export type TClaimedMissionSettlement = Extract<TMissionSettlementClaimResult, { status: "claimed" }>;

const isDuplicateKeyError = (error: unknown): boolean =>
    Boolean(error && typeof error == "object" && "code" in error && (error as { code?: unknown }).code == 11000);

export const getMissionSettlementKey = (report: TMissionSettlementIdentity): string | undefined => {
    const sessionId = typeof report.sharedSessionId == "string" ? report.sharedSessionId.trim() : "";
    const repHash = typeof report.RepHash == "string" ? report.RepHash.trim() : "";
    const rewardInfo = report.RewardInfo;
    // Bounty checkpoints have no final-match session ID or RepHash; the job, stage and mission timestamp identify them.
    const isStageOnlyBounty =
        report.EndOfMatchUpload !== true &&
        !sessionId &&
        !repHash &&
        Boolean(rewardInfo?.jobId) &&
        Number.isSafeInteger(rewardInfo?.JobStage) &&
        rewardInfo!.JobStage! >= 0;
    // Railjack interstitial reports omit both final-match identity fields; the node, checkpoint and mission timestamp
    // identify the report while keeping the exception limited to actual Railjack nodes.
    const checkpointCounter = rewardInfo?.CheckpointCounter;
    const isRailjackCheckpoint =
        report.RJ === true &&
        /^CrewBattleNode\d+$/.test(rewardInfo?.node ?? "") &&
        checkpointCounter !== undefined &&
        Number.isSafeInteger(checkpointCounter) &&
        checkpointCounter >= 1;
    const hasValidRepHash = Boolean(repHash) && repHash.length <= 256;
    const hasSessionIdentity = /^[\da-f]{24}$/i.test(sessionId) && hasValidRepHash;
    const isSessionlessEndOfMatch = report.EndOfMatchUpload === true && !sessionId && hasValidRepHash;
    if (
        !Number.isSafeInteger(report.MissionPTS) ||
        (!isStageOnlyBounty && !hasSessionIdentity && !isSessionlessEndOfMatch && !isRailjackCheckpoint)
    ) {
        return undefined;
    }

    const identity = {
        sessionId: sessionId.toLowerCase(),
        missionPTS: report.MissionPTS,
        repHash,
        missionTag: report.Missions?.Tag ?? rewardInfo?.node ?? "",
        missionTier: report.Missions?.Tier ?? null,
        node: rewardInfo?.node ?? "",
        jobId: rewardInfo?.jobId ?? "",
        jobStage: rewardInfo?.JobStage ?? null,
        checkpointCounter: rewardInfo?.CheckpointCounter ?? null,
        challengeMissionId: rewardInfo?.challengeMissionId ?? "",
        sortieId: rewardInfo?.sortieId ?? "",
        sortieTag: rewardInfo?.sortieTag ?? "",
        alertId: rewardInfo?.alertId ?? "",
        goalId: rewardInfo?.goalId ?? "",
        invasionId: rewardInfo?.invasionId ?? "",
        periodicMissionTag: rewardInfo?.periodicMissionTag ?? "",
        duviriType: rewardInfo?.T ?? null,
        missionType: rewardInfo?.missionType ?? "",
        conquestType: rewardInfo?.ConquestType ?? "",
        conquestCompleted: rewardInfo?.ConquestCompleted ?? null,
        encounterEnemyLevel: rewardInfo?.EncounterEnemyLevel ?? null
    };

    return crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex");
};

export const claimMissionSettlement = async (
    accountId: Types.ObjectId,
    settlementKey: string,
    now = new Date()
): Promise<TMissionSettlementClaimResult> => {
    const claimToken = crypto.randomUUID();
    const staleBefore = new Date(now.getTime() - CLAIM_LEASE_MS);

    try {
        const claim = await MissionSettlementClaim.findOneAndUpdate(
            {
                accountId,
                settlementKey,
                $or: [{ status: "processing", claimedAt: { $lt: staleBefore } }, { status: { $exists: false } }]
            },
            {
                $set: {
                    status: "processing",
                    claimToken,
                    claimedAt: now
                },
                $setOnInsert: { accountId, settlementKey }
            },
            { upsert: true, returnDocument: "after" }
        );

        if (claim.claimToken == claimToken) {
            return { status: "claimed", claimId: claim._id, claimToken };
        }
        return { status: "busy" };
    } catch (error) {
        if (!isDuplicateKeyError(error)) {
            throw error;
        }
        const existing = await MissionSettlementClaim.findOne({ accountId, settlementKey }, "status").lean();
        return { status: existing?.status == "completed" ? "completed" : "busy" };
    }
};

export const completeMissionSettlementClaim = async (
    claim: TClaimedMissionSettlement,
    completedAt = new Date()
): Promise<void> => {
    await MissionSettlementClaim.updateOne(
        {
            _id: claim.claimId,
            claimToken: claim.claimToken,
            status: "processing"
        },
        {
            $set: {
                status: "completed",
                completedAt
            }
        }
    );
};
