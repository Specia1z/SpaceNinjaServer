import { randomBytes } from "node:crypto";
import type { HydratedDocument, Types } from "mongoose";
import { Account } from "../models/loginModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { config } from "./configService.ts";
import type { IDatabaseAccountJson } from "../types/loginTypes.ts";
import type { IRegistrationFingerprint } from "./registrationRateLimitService.ts";

const rewardAmount = (value: number | undefined): number =>
    typeof value == "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000 ? value : 0;

const requiredOnlineSeconds = (): number => {
    const minutes = config.playerPortal?.referralRequiredOnlineMinutes;
    return (
        (typeof minutes == "number" && Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= 10_080
            ? minutes
            : 30) * 60
    );
};

export const generateReferralCode = async (accountId: Types.ObjectId): Promise<string> => {
    const account = await Account.findById(accountId);
    if (!account) throw new Error("account not found");
    if (account.ReferralCode) return account.ReferralCode;
    for (let attempt = 0; attempt < 5; ++attempt) {
        const code = randomBytes(9).toString("base64url").toUpperCase();
        try {
            const updated = await Account.findOneAndUpdate(
                { _id: accountId, ReferralCode: { $exists: false } },
                { $set: { ReferralCode: code } },
                { new: true }
            );
            if (updated) return updated.ReferralCode!;
            const current = await Account.findById(accountId);
            if (current?.ReferralCode) return current.ReferralCode;
        } catch (error) {
            if ((error as { code?: number }).code != 11000) throw error;
        }
    }
    throw new Error("could not generate invite code");
};

export const reserveReferral = async (
    code: string,
    inviteeFingerprint: IRegistrationFingerprint = {}
): Promise<{
    inviterId: Types.ObjectId;
    inviterReward: number;
    inviteeReward: number;
    milestoneBonus: number;
    reservedCount: boolean;
    risk?: "same_registration_source";
} | null> => {
    const policy = config.playerPortal ?? {};
    if (policy.referralsEnabled === false) return null;
    if (!/^[A-Z0-9_-]{8,32}$/.test(code)) return null;
    const configuredMax = policy.maxReferralsPerAccount ?? 25;
    const max = Number.isSafeInteger(configuredMax) ? Math.max(0, Math.min(100_000, configuredMax)) : 25;
    if (!max) return null;
    const candidate = await Account.findOne({ ReferralCode: code, Banned: { $ne: true } });
    if (!candidate) return null;
    const sameRegistrationSource = Boolean(
        inviteeFingerprint.ipHash &&
        (candidate.RegistrationIpHash ?? candidate.LastKnownIpHash) == inviteeFingerprint.ipHash
    );
    const inviter = sameRegistrationSource
        ? candidate
        : await Account.findOneAndUpdate(
              {
                  _id: candidate._id,
                  $or: [{ ReferralCount: { $exists: false } }, { ReferralCount: { $lt: max } }]
              },
              { $inc: { ReferralCount: 1 } },
              { new: true }
          );
    if (!inviter) return null;
    const every = rewardAmount(policy.milestoneEvery ?? 5);
    return {
        inviterId: inviter._id,
        inviterReward: rewardAmount(policy.inviterReward ?? 25),
        inviteeReward: rewardAmount(policy.inviteeReward ?? 25),
        milestoneBonus:
            !sameRegistrationSource && every && inviter.ReferralCount! % every == 0
                ? rewardAmount(policy.milestoneBonus ?? 50)
                : 0,
        reservedCount: !sameRegistrationSource,
        ...(sameRegistrationSource ? { risk: "same_registration_source" as const } : {})
    };
};

export const releaseReferral = async (inviterId: Types.ObjectId): Promise<void> => {
    await Account.updateOne({ _id: inviterId, ReferralCount: { $gt: 0 } }, { $inc: { ReferralCount: -1 } });
};

export const markReferralOnlineStart = async (accountId: Types.ObjectId): Promise<void> => {
    await Account.updateOne(
        {
            _id: accountId,
            ReferredBy: { $exists: true },
            ReferralQualifiedAt: { $exists: false },
            ReferralOnlineStartedAt: { $exists: false }
        },
        { $set: { ReferralOnlineStartedAt: new Date() } }
    );
};

export const markReferralOnlineEnd = async (
    accountId: Types.ObjectId
): Promise<HydratedDocument<IDatabaseAccountJson> | null> => {
    const active = await Account.findOneAndUpdate(
        { _id: accountId, ReferralOnlineStartedAt: { $exists: true }, ReferralQualifiedAt: { $exists: false } },
        { $unset: { ReferralOnlineStartedAt: 1 } },
        { new: false }
    );
    if (!active?.ReferralOnlineStartedAt) return null;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - active.ReferralOnlineStartedAt.getTime()) / 1000));
    return Account.findOneAndUpdate(
        { _id: accountId },
        { $inc: { ReferralOnlineSeconds: elapsedSeconds } },
        { new: true }
    );
};

export const approveReferralRisk = async (
    accountId: Types.ObjectId
): Promise<HydratedDocument<IDatabaseAccountJson> | null> =>
    Account.findOneAndUpdate(
        { _id: accountId, ReferralRisk: { $exists: true } },
        { $unset: { ReferralRisk: 1 } },
        { new: true }
    );

// Each inventory claims each side of an invitation separately. A failed/partial payout can be retried
// without ever granting the same reward twice, including after a process restart.
export const settleReferral = async (
    account: Pick<
        IDatabaseAccountJson,
        | "ReferredBy"
        | "ReferralInviterReward"
        | "ReferralInviteeReward"
        | "ReferralMilestoneBonus"
        | "ReferralOnlineSeconds"
        | "ReferralQualifiedAt"
        | "ReferralRisk"
    > & { _id: Types.ObjectId }
): Promise<void> => {
    if (!account.ReferredBy) return;
    if (account.ReferralRisk) return;
    if (!account.ReferralQualifiedAt && (account.ReferralOnlineSeconds ?? 0) < requiredOnlineSeconds()) return;
    if (!account.ReferralQualifiedAt) {
        const qualified = await Account.findOneAndUpdate(
            { _id: account._id, ReferralQualifiedAt: { $exists: false } },
            { $set: { ReferralQualifiedAt: new Date() } },
            { new: true }
        );
        if (!qualified) return;
        account = qualified;
    }
    const id = account._id.toString();
    const sides = [
        { owner: account._id, claim: `referral:${id}:invitee`, amount: rewardAmount(account.ReferralInviteeReward) },
        {
            owner: account.ReferredBy,
            claim: `referral:${id}:inviter`,
            amount: rewardAmount(account.ReferralInviterReward) + rewardAmount(account.ReferralMilestoneBonus)
        }
    ];
    for (const side of sides) {
        if (!side.amount) continue;
        const result = await Inventory.updateOne(
            { accountOwnerId: side.owner, ReferralRewardClaims: { $ne: side.claim } },
            {
                $inc: { PremiumCredits: side.amount, PremiumCreditsFree: side.amount },
                $addToSet: { ReferralRewardClaims: side.claim }
            }
        );
        if (!result.matchedCount) {
            const inventory = await Inventory.findOne({ accountOwnerId: side.owner }, "ReferralRewardClaims");
            if (!inventory?.ReferralRewardClaims?.includes(side.claim))
                throw new Error("referral inventory unavailable");
        }
    }
};
