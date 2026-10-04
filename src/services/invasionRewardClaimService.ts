import crypto from "node:crypto";
import type { Types } from "mongoose";
import { InvasionRewardClaim } from "../models/invasionRewardClaimModel.ts";

const CLAIM_LEASE_MS = 5 * 60_000;

export type TInvasionRewardClaimResult =
    | { status: "claimed"; claimId: Types.ObjectId; claimToken: string }
    | { status: "busy" }
    | { status: "completed" };

const isDuplicateKeyError = (error: unknown): boolean =>
    Boolean(error && typeof error == "object" && "code" in error && (error as { code?: unknown }).code == 11000);

export const claimInvasionReward = async (
    accountId: Types.ObjectId,
    invasionId: string,
    now = new Date()
): Promise<TInvasionRewardClaimResult> => {
    const claimToken = crypto.randomUUID();
    const staleBefore = new Date(now.getTime() - CLAIM_LEASE_MS);

    try {
        const claim = await InvasionRewardClaim.findOneAndUpdate(
            {
                accountId,
                invasionId,
                $or: [{ status: "processing", claimedAt: { $lt: staleBefore } }, { status: { $exists: false } }]
            },
            {
                $set: {
                    status: "processing",
                    claimToken,
                    claimedAt: now
                },
                $setOnInsert: { accountId, invasionId }
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
        const existing = await InvasionRewardClaim.findOne({ accountId, invasionId }, "status").lean();
        return { status: existing?.status == "completed" ? "completed" : "busy" };
    }
};

export const completeInvasionRewardClaim = async (
    claim: Extract<TInvasionRewardClaimResult, { status: "claimed" }>,
    completedAt = new Date()
): Promise<void> => {
    await InvasionRewardClaim.updateOne(
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
