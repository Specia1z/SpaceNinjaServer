import type { RequestHandler } from "express";
import { Account } from "../models/loginModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { config, type IPlayerPortalConfig } from "../services/configService.ts";
import {
    changePlayerName,
    createPlayerSession,
    getPlayerAccount,
    playerPolicy,
    revokePlayerSession,
    validatePlayerPolicy
} from "../services/playerPortalService.ts";
import {
    createAccount,
    createNonce,
    getAccountForRequest,
    getUsernameFromEmail,
    isAdministrator,
    isCorrectPassword
} from "../services/loginService.ts";
import { generateReferralCode, settleReferral } from "../services/playerReferralService.ts";
import { getRegistrationAddress, reserveRegistration } from "../services/registrationRateLimitService.ts";
import { hashAccountPassword } from "../services/passwordService.ts";
import { PlayerSession } from "../models/playerSessionModel.ts";
import { saveConfig } from "../services/configWriterService.ts";
import { getBuildLabelForUnauthenticatedRequest } from "../services/loginService.ts";
import type { TAccountDocument } from "../services/loginService.ts";

const bodyOf = (req: Parameters<RequestHandler>[0]): Record<string, unknown> => {
    return (req.body && typeof req.body == "object" ? req.body : {}) as Record<string, unknown>;
};

const sendError = (res: Parameters<RequestHandler>[1], status: number, error: string): void => {
    res.status(status).json({ error });
};

const requirePlayer = async (
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1]
): Promise<TAccountDocument | null> => {
    const account = await getPlayerAccount(req);
    if (!account) {
        sendError(res, 401, "login_required");
        return null;
    }
    return account;
};

const accountSummary = async (
    account: Awaited<ReturnType<typeof getPlayerAccount>>
): Promise<Record<string, unknown> | null> => {
    if (!account) return null;
    const inventory = await Inventory.findOne(
        { accountOwnerId: account._id },
        "PremiumCredits PremiumCreditsFree"
    ).lean();
    return {
        id: account._id.toString(),
        email: account.email,
        displayName: account.DisplayName,
        platinum: inventory?.PremiumCredits ?? 0,
        freePlatinum: inventory?.PremiumCreditsFree ?? 0,
        referralCode: playerPolicy().referralsEnabled ? await generateReferralCode(account._id) : null,
        referralCount: account.ReferralCount ?? 0,
        isAdmin: isAdministrator(account),
        lastRenameAt: account.LastPlayerRenameAt?.toISOString() ?? null,
        policy: {
            renameCost: playerPolicy().renameCost,
            renameCooldownDays: playerPolicy().renameCooldownDays,
            renameEnabled: playerPolicy().renameEnabled,
            referralsEnabled: playerPolicy().referralsEnabled,
            inviterReward: playerPolicy().inviterReward,
            inviteeReward: playerPolicy().inviteeReward,
            maxReferralsPerAccount: playerPolicy().maxReferralsPerAccount,
            milestoneEvery: playerPolicy().milestoneEvery,
            milestoneBonus: playerPolicy().milestoneBonus
        }
    };
};

export const playerLoginController: RequestHandler = async (req, res) => {
    if (!playerPolicy().enabled) return sendError(res, 404, "portal_disabled");
    const body = bodyOf(req);
    if (typeof body.email != "string" || typeof body.password != "string") return sendError(res, 400, "invalid_login");
    const account = await Account.findOne({ email: body.email.trim().toLowerCase() });
    if (!account || account.Banned || !(await isCorrectPassword(body.password, account.password))) {
        return sendError(res, 401, "invalid_login");
    }
    if (!account.PlayerPasswordVersion) {
        account.password = await hashAccountPassword(body.password);
        account.PlayerPasswordVersion = 1;
        await account.save();
    }
    try {
        await settleReferral(account);
    } catch {
        // Retry the claim on the next successful login if the inventory is temporarily unavailable.
    }
    await createPlayerSession(req, res, account);
    res.json(await accountSummary(account));
};

export const playerRegisterController: RequestHandler = async (req, res) => {
    const policy = playerPolicy();
    if (!policy.enabled || !policy.registrationEnabled) return sendError(res, 403, "registration_disabled");
    const body = bodyOf(req);
    if (
        typeof body.email != "string" ||
        typeof body.password != "string" ||
        body.password.length < 8 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
    ) {
        return sendError(res, 400, "invalid_registration");
    }
    const email = body.email.trim().toLowerCase();
    if (await Account.exists({ email })) return sendError(res, 409, "email_taken");
    const reservation = reserveRegistration(
        getRegistrationAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"])
    );
    if (!reservation.allowed) {
        res.set("Retry-After", String(reservation.retryAfterSeconds));
        return sendError(res, 429, "registration_rate_limited");
    }
    try {
        const account = await createAccount(
            {
                email,
                password: body.password,
                DisplayName: await getUsernameFromEmail(email),
                Language: typeof body.language == "string" ? body.language : undefined,
                ClientType: "player-portal",
                BuildLabel: getBuildLabelForUnauthenticatedRequest(req),
                LastLogin: new Date(),
                Nonce: createNonce()
            },
            typeof body.referralCode == "string" ? body.referralCode : undefined
        );
        const saved = await Account.findById(account.id);
        if (!saved) return sendError(res, 500, "account_creation_failed");
        await createPlayerSession(req, res, saved);
        res.status(201).json(await accountSummary(saved));
    } catch (error) {
        reservation.cancel();
        if ((error as { code?: number }).code == 11000) return sendError(res, 409, "account_already_exists");
        throw error;
    }
};

export const playerMeController: RequestHandler = async (req, res) => {
    const account = await requirePlayer(req, res);
    if (account) res.json(await accountSummary(account));
};

export const playerLogoutController: RequestHandler = async (req, res) => {
    await revokePlayerSession(req, res);
    res.json({ ok: true });
};

export const playerRenameController: RequestHandler = async (req, res) => {
    const account = await requirePlayer(req, res);
    if (!account) return;
    const body = bodyOf(req);
    if (typeof body.currentPassword != "string" || typeof body.newName != "string")
        return sendError(res, 400, "invalid_name");
    const result = await changePlayerName(
        account,
        body.newName.trim(),
        await isCorrectPassword(body.currentPassword, account.password)
    );
    if (result != "ok") return sendError(res, result == "taken" ? 409 : result == "funds" ? 402 : 400, result);
    res.json(await accountSummary(await Account.findById(account._id)));
};

export const playerPasswordController: RequestHandler = async (req, res) => {
    const account = await requirePlayer(req, res);
    if (!account) return;
    const body = bodyOf(req);
    if (typeof body.currentPassword != "string" || typeof body.newPassword != "string" || body.newPassword.length < 8) {
        return sendError(res, 400, "invalid_password");
    }
    if (!(await isCorrectPassword(body.currentPassword, account.password)))
        return sendError(res, 403, "wrong_password");
    account.password = await hashAccountPassword(body.newPassword);
    account.PlayerPasswordVersion = (account.PlayerPasswordVersion ?? 0) + 1;
    await account.save();
    await PlayerSession.deleteMany({ accountId: account._id });
    res.json({ ok: true });
};

export const getPlayerPolicyController: RequestHandler = (_req, res) => {
    res.json(playerPolicy());
};

export const getPlayerAdminPolicyController: RequestHandler = async (req, res) => {
    const account = await getAccountForAdmin(req, res);
    if (account) res.json(config.playerPortal ?? playerPolicy());
};

export const setPlayerAdminPolicyController: RequestHandler = async (req, res) => {
    const account = await getAccountForAdmin(req, res);
    if (!account) return;
    const next = bodyOf(req) as unknown as IPlayerPortalConfig;
    const merged = { ...playerPolicy(), ...next };
    if (!validatePlayerPolicy(merged)) return sendError(res, 400, "invalid_policy");
    config.playerPortal = merged;
    await saveConfig();
    res.json(merged);
};

const getAccountForAdmin = async (
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1]
): Promise<TAccountDocument | null> => {
    let account: TAccountDocument;
    try {
        account = (await getPlayerAccount(req)) ?? (await getAccountForRequest(req));
    } catch {
        sendError(res, 401, "login_required");
        return null;
    }
    if (!isAdministrator(account)) {
        sendError(res, 403, "admin_required");
        return null;
    }
    return account;
};
