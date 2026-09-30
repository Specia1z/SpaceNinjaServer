import type { RequestHandler } from "express";
import { Account } from "../models/loginModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { config, type IPlayerPortalConfig } from "../services/configService.ts";
import {
    changePlayerName,
    createPlayerSession,
    getPlayerRenameStatus,
    getPlayerAccount,
    playerPolicy,
    resetPlayerRenameCooldown,
    revokePlayerSession,
    validatePlayerPolicy
} from "../services/playerPortalService.ts";
import {
    createAccount,
    createNonce,
    getAccountForRequest,
    findAccountByEmail,
    getUsernameFromEmail,
    isAdministrator,
    isCorrectPassword
} from "../services/loginService.ts";
import { approveReferralRisk, generateReferralCode, settleReferral } from "../services/playerReferralService.ts";
import {
    getRegistrationAddress,
    getRegistrationFingerprint,
    reserveRegistration
} from "../services/registrationRateLimitService.ts";
import { hashAccountPassword, identifyAccountPassword } from "../services/passwordService.ts";
import { whirlpoolHash } from "../services/whirlpoolService.ts";
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
    const policy = playerPolicy();
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
        referralCode: policy.referralsEnabled ? await generateReferralCode(account._id) : null,
        referralCount: account.ReferralCount ?? 0,
        referralQualification: account.ReferredBy
            ? {
                  qualified: Boolean(account.ReferralQualifiedAt),
                  onlineSeconds: account.ReferralOnlineSeconds ?? 0,
                  requiredOnlineSeconds: policy.referralRequiredOnlineMinutes * 60,
                  risk: Boolean(account.ReferralRisk)
              }
            : null,
        isAdmin: isAdministrator(account),
        lastRenameAt: account.LastPlayerRenameAt?.toISOString() ?? null,
        rename: getPlayerRenameStatus(account),
        policy: {
            renameCost: policy.renameCost,
            renameCooldownDays: policy.renameCooldownDays,
            renameEnabled: policy.renameEnabled,
            firstRenameEnabled: policy.firstRenameEnabled,
            referralsEnabled: policy.referralsEnabled,
            inviterReward: policy.inviterReward,
            inviteeReward: policy.inviteeReward,
            maxReferralsPerAccount: policy.maxReferralsPerAccount,
            referralRequiredOnlineMinutes: policy.referralRequiredOnlineMinutes,
            milestoneEvery: policy.milestoneEvery,
            milestoneBonus: policy.milestoneBonus
        }
    };
};

export const playerLoginController: RequestHandler = async (req, res) => {
    if (!playerPolicy().enabled) return sendError(res, 404, "portal_disabled");
    const body = bodyOf(req);
    if (typeof body.email != "string" || typeof body.password != "string") return sendError(res, 400, "invalid_login");
    const account = await findAccountByEmail(body.email);
    const passwordProtocol = account ? await identifyAccountPassword(body.password, account.password) : false;
    if (!account || account.Banned || passwordProtocol == false) {
        return sendError(res, 401, "invalid_login");
    }
    const loginIpHash = getRegistrationFingerprint(req.socket.remoteAddress, req.headers["x-forwarded-for"]).ipHash;
    if (loginIpHash) account.LastKnownIpHash = loginIpHash;
    if (!account.PlayerPasswordVersion || passwordProtocol == "raw") {
        // Keep both the raw-player and WebUI-Whirlpool login paths valid after migrating a legacy account.
        account.password = await hashAccountPassword(whirlpoolHash(body.password));
        account.PlayerPasswordVersion = 1;
    }
    await account.save();
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
    if (await findAccountByEmail(email)) return sendError(res, 409, "email_taken");
    const reservation = reserveRegistration(
        getRegistrationAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"])
    );
    if (!reservation.allowed) {
        res.set("Retry-After", String(reservation.retryAfterSeconds));
        return sendError(res, 429, "registration_rate_limited");
    }
    const registrationFingerprint = getRegistrationFingerprint(
        req.socket.remoteAddress,
        req.headers["x-forwarded-for"]
    );
    try {
        const account = await createAccount(
            {
                email,
                password: whirlpoolHash(body.password),
                DisplayName: await getUsernameFromEmail(email),
                Language: typeof body.language == "string" ? body.language : undefined,
                ClientType: "player-portal",
                BuildLabel: getBuildLabelForUnauthenticatedRequest(req),
                RegistrationIpHash: registrationFingerprint.ipHash,
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
    if (account) {
        const ipHash = getRegistrationFingerprint(req.socket.remoteAddress, req.headers["x-forwarded-for"]).ipHash;
        if (ipHash && account.LastKnownIpHash != ipHash) {
            account.LastKnownIpHash = ipHash;
            await account.save();
        }
        res.json(await accountSummary(account));
    }
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
    account.password = await hashAccountPassword(whirlpoolHash(body.newPassword));
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
    if (account) res.json({ ...playerPolicy(), ...config.playerPortal });
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

export const resetPlayerRenameCooldownController: RequestHandler = async (req, res) => {
    const account = await getAccountForAdmin(req, res);
    if (!account) return;
    const body = bodyOf(req);
    if (typeof body.email != "string" || !body.email.trim()) return sendError(res, 400, "invalid_player");
    const player = await findAccountByEmail(body.email.trim());
    if (!player) return sendError(res, 404, "player_not_found");
    await resetPlayerRenameCooldown(player);
    res.json({ ok: true, displayName: player.DisplayName });
};

export const approvePlayerReferralController: RequestHandler = async (req, res) => {
    const account = await getAccountForAdmin(req, res);
    if (!account) return;
    const body = bodyOf(req);
    if (typeof body.email != "string" || !body.email.trim()) return sendError(res, 400, "invalid_player");
    const player = await findAccountByEmail(body.email.trim());
    if (!player) return sendError(res, 404, "player_not_found");
    const approved = await approveReferralRisk(player._id);
    if (!approved) return sendError(res, 409, "referral_not_flagged");
    await settleReferral(approved);
    res.json({ ok: true, displayName: approved.DisplayName });
};

export const getAccountForAdmin = async (
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
