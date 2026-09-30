import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { Account } from "../models/loginModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { PlayerSession } from "../models/playerSessionModel.ts";
import type { TAccountDocument } from "./loginService.ts";
import { config, type IPlayerPortalConfig } from "./configService.ts";
import { isAdministrator } from "./loginService.ts";
import { saveConfig } from "./configWriterService.ts";

const COOKIE = "sns_player_session";
const SESSION_AGE = 12 * 60 * 60 * 1000;

const booleanSetting = (value: unknown, fallback: boolean): boolean => (typeof value == "boolean" ? value : fallback);
const integerSetting = (value: unknown, fallback: number, max: number): number =>
    typeof value == "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : fallback;

export const playerPolicy = (): Required<IPlayerPortalConfig> => ({
    enabled: booleanSetting(config.playerPortal?.enabled, true),
    registrationEnabled: booleanSetting(config.playerPortal?.registrationEnabled, true),
    renameEnabled: booleanSetting(config.playerPortal?.renameEnabled, true),
    renameCost: integerSetting(config.playerPortal?.renameCost, 50, 1_000_000),
    renameCooldownDays: integerSetting(config.playerPortal?.renameCooldownDays, 30, 3650),
    referralsEnabled: booleanSetting(config.playerPortal?.referralsEnabled, true),
    inviterReward: integerSetting(config.playerPortal?.inviterReward, 25, 100_000),
    inviteeReward: integerSetting(config.playerPortal?.inviteeReward, 25, 100_000),
    maxReferralsPerAccount: integerSetting(config.playerPortal?.maxReferralsPerAccount, 25, 100_000),
    milestoneEvery: integerSetting(config.playerPortal?.milestoneEvery, 5, 100_000),
    milestoneBonus: integerSetting(config.playerPortal?.milestoneBonus, 50, 100_000)
});

const policyLimits: Record<keyof Required<IPlayerPortalConfig>, number | null> = {
    enabled: null,
    registrationEnabled: null,
    renameEnabled: null,
    renameCost: 1_000_000,
    renameCooldownDays: 3650,
    referralsEnabled: null,
    inviterReward: 100_000,
    inviteeReward: 100_000,
    maxReferralsPerAccount: 100_000,
    milestoneEvery: 100_000,
    milestoneBonus: 100_000
};

export const validatePlayerPolicy = (value: unknown): value is Required<IPlayerPortalConfig> => {
    if (!value || typeof value != "object" || Array.isArray(value)) return false;
    const input = value as Record<string, unknown>;
    return (
        Object.keys(input).length == Object.keys(policyLimits).length &&
        Object.entries(policyLimits).every(([key, max]) => {
            const field = input[key];
            return max === null
                ? typeof field == "boolean"
                : typeof field == "number" && Number.isSafeInteger(field) && field >= 0 && field <= max;
        })
    );
};

export const validatePlayerPolicyField = (id: string, value: unknown): string | undefined => {
    if (!id.startsWith("playerPortal.")) return undefined;
    const key = id.substring("playerPortal.".length) as keyof Required<IPlayerPortalConfig>;
    if (!(key in policyLimits)) return `unknown playerPortal setting: ${id}`;
    const max = policyLimits[key];
    const valid =
        max === null
            ? typeof value == "boolean"
            : typeof value == "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
    return valid ? undefined : `${id} has an invalid value`;
};

const cookieOptions = (req: Request): string =>
    `Path=/player; HttpOnly; SameSite=Strict${req.secure ? "; Secure" : ""}`;

const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");

export const createPlayerSession = async (req: Request, res: Response, account: TAccountDocument): Promise<void> => {
    const token = randomBytes(32).toString("base64url");
    await PlayerSession.create({
        accountId: account._id,
        tokenHash: tokenHash(token),
        passwordVersion: account.PlayerPasswordVersion ?? 0,
        expiresAt: new Date(Date.now() + SESSION_AGE)
    });
    res.setHeader("Set-Cookie", `${COOKIE}=${token}; Max-Age=${SESSION_AGE / 1000}; ${cookieOptions(req)}`);
};

const sessionToken = (req: Request): string | undefined => {
    const cookies = req.headers.cookie?.split(";") ?? [];
    const value = cookies
        .find(cookie => cookie.trim().startsWith(`${COOKIE}=`))
        ?.trim()
        .slice(COOKIE.length + 1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
};

export const getPlayerAccount = async (req: Request): Promise<TAccountDocument | null> => {
    const token = sessionToken(req);
    if (!token) return null;
    const session = await PlayerSession.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const account = await Account.findById(session.accountId);
    if (!account || account.Banned || session.passwordVersion != (account.PlayerPasswordVersion ?? 0)) return null;
    return account;
};

export const revokePlayerSession = async (req: Request, res: Response): Promise<void> => {
    const token = sessionToken(req);
    if (token) await PlayerSession.deleteOne({ tokenHash: tokenHash(token) });
    res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; ${cookieOptions(req)}`);
};

export const changePlayerName = async (
    account: TAccountDocument,
    newName: string,
    passwordVerified: boolean
): Promise<"ok" | "invalid" | "taken" | "cooldown" | "funds" | "disabled"> => {
    const policy = playerPolicy();
    if (!policy.renameEnabled) return "disabled";
    if (
        !passwordVerified ||
        newName.length < 1 ||
        newName.length > 24 ||
        newName.trim() != newName ||
        /[\p{C}]/u.test(newName) ||
        newName.toLowerCase() == "all"
    )
        return "invalid";
    if (newName.toLowerCase() == account.DisplayName.toLowerCase()) return "invalid";
    if ((config.administratorNames ?? []).some(name => name.toLowerCase() == newName.toLowerCase())) return "taken";
    if (await Account.exists({ DisplayName: { $regex: `^${newName}$`, $options: "i" } })) return "taken";
    const cutoff = new Date(Date.now() - policy.renameCooldownDays * 86_400_000);
    if (account.LastPlayerRenameAt && account.LastPlayerRenameAt > cutoff) return "cooldown";

    const inventory = await Inventory.findOne({ accountOwnerId: account._id }, "PremiumCredits PremiumCreditsFree");
    if (!inventory || inventory.PremiumCredits < policy.renameCost) return "funds";
    const freeSpent = Math.min(inventory.PremiumCreditsFree, policy.renameCost);
    const charged = await Inventory.updateOne(
        { _id: inventory._id, PremiumCredits: { $gte: policy.renameCost } },
        { $inc: { PremiumCredits: -policy.renameCost, PremiumCreditsFree: -freeSpent } }
    );
    if (!charged.modifiedCount && policy.renameCost) return "funds";

    try {
        const changed = await Account.updateOne(
            {
                _id: account._id,
                DisplayName: account.DisplayName,
                $or: [{ LastPlayerRenameAt: { $exists: false } }, { LastPlayerRenameAt: { $lte: cutoff } }]
            },
            { $set: { DisplayName: newName, LastPlayerRenameAt: new Date() } }
        );
        if (!changed.modifiedCount) {
            if (policy.renameCost)
                await Inventory.updateOne(
                    { _id: inventory._id },
                    { $inc: { PremiumCredits: policy.renameCost, PremiumCreditsFree: freeSpent } }
                );
            return "cooldown";
        }
    } catch (error) {
        if (policy.renameCost)
            await Inventory.updateOne(
                { _id: inventory._id },
                { $inc: { PremiumCredits: policy.renameCost, PremiumCreditsFree: freeSpent } }
            );
        if ((error as { code?: number }).code == 11000) return "taken";
        throw error;
    }
    if (isAdministrator(account)) {
        const index = config.administratorNames?.findIndex(name => name == account.DisplayName) ?? -1;
        if (index != -1) {
            config.administratorNames![index] = newName;
            await saveConfig();
        }
    }
    return "ok";
};
