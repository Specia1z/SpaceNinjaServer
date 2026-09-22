import type { RequestHandler } from "express";
import {
    getAccountForRequest,
    getAccountIdForRequest,
    isAdministrator,
    type TAccountDocument
} from "../../services/loginService.ts";
import {
    createRedeemCodes,
    deleteRedeemCode,
    generateCode,
    listRedeemCodes,
    saveRedeemCode,
    redeemCode
} from "../../services/redeemCodeService.ts";
import { MAX_REDEEM_CODE_LENGTH, MAX_REDEEM_CODE_USES, type IRedeemCode } from "../../models/redeemCodeModel.ts";
import { addItems, getInventory } from "../../services/inventoryService.ts";
import { broadcastInventoryUpdate } from "../../services/wsService.ts";
import type { ITypeCount } from "../../types/commonTypes.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

const MAX_BATCH_REDEEM_CODES = 500;
const MIN_CODE_LENGTH = 4;

const parseRewards = (value: unknown): ITypeCount[] => {
    if (!Array.isArray(value) || value.length == 0) {
        throw new Error("At least one reward is required");
    }
    if (value.length > 100) {
        throw new Error("A code can grant at most 100 reward entries");
    }
    return value.map((raw, index) => {
        const reward = raw as Partial<ITypeCount>;
        if (
            typeof reward.ItemType != "string" ||
            !reward.ItemType.startsWith("/Lotus/") ||
            reward.ItemType.length > 300
        ) {
            throw new Error(`Reward ${index + 1} has an invalid ItemType`);
        }
        if (
            typeof reward.ItemCount != "number" ||
            !Number.isInteger(reward.ItemCount) ||
            reward.ItemCount == 0 ||
            reward.ItemCount < -1_000_000 ||
            reward.ItemCount > 1_000_000
        ) {
            throw new Error(`Reward ${index + 1} needs a non-zero whole ItemCount between -1000000 and 1000000`);
        }
        return { ItemType: reward.ItemType, ItemCount: reward.ItemCount };
    });
};

const parseExpiresAt = (value: unknown): Date | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value != "string") throw new Error("Invalid ExpiresAt");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid ExpiresAt");
    return date;
};

const parseMaxUses = (value: unknown): number => {
    if (value === undefined || value === null || value === "") return 0;
    if (typeof value != "number" || !Number.isInteger(value) || value < 0 || value > MAX_REDEEM_CODE_USES) {
        throw new Error(`MaxUses must be a whole number between 0 (unlimited) and ${MAX_REDEEM_CODE_USES}`);
    }
    return value;
};

export const listRedeemCodesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json(await listRedeemCodes());
};

export const saveRedeemCodeController: RequestHandler = async (req, res) => {
    const account = await getAdministrator(req);
    const body = req.body as Partial<IRedeemCode>;

    if (
        typeof body.Code != "string" ||
        body.Code.trim().length < MIN_CODE_LENGTH ||
        body.Code.trim().length > MAX_REDEEM_CODE_LENGTH
    ) {
        throw new Error(`Code must be between ${MIN_CODE_LENGTH} and ${MAX_REDEEM_CODE_LENGTH} characters`);
    }
    if (body.Label !== undefined && body.Label !== "" && (typeof body.Label != "string" || body.Label.length > 200)) {
        throw new Error("Invalid Label");
    }

    const normalizedCode = body.Code.trim().toUpperCase();
    // Uses and UsedBy are server bookkeeping, so an edit preserves them rather than resetting redemption history.
    const existing = await findRedeemCode(normalizedCode);
    if (
        existing &&
        body.MaxUses !== undefined &&
        existing.Uses > parseMaxUses(body.MaxUses) &&
        parseMaxUses(body.MaxUses) > 0
    ) {
        throw new Error("MaxUses cannot be lower than the number of redemptions already made");
    }

    const code: IRedeemCode = {
        Code: normalizedCode,
        Label: typeof body.Label == "string" && body.Label ? body.Label : undefined,
        Rewards: parseRewards(body.Rewards),
        ExpiresAt: parseExpiresAt(body.ExpiresAt),
        MaxUses: parseMaxUses(body.MaxUses),
        Uses: existing?.Uses ?? 0,
        UsedBy: existing?.UsedBy ?? [],
        Enabled: body.Enabled !== false,
        CreatedBy: existing?.CreatedBy ?? account.DisplayName
    };
    res.json(await saveRedeemCode(code));
};

export const generateRedeemCodesController: RequestHandler = async (req, res) => {
    const account = await getAdministrator(req);
    const body = req.body as Partial<IRedeemCode> & { Count?: unknown; CodeLength?: unknown; Prefix?: unknown };

    const count = body.Count ?? 1;
    if (typeof count != "number" || !Number.isInteger(count) || count < 1 || count > MAX_BATCH_REDEEM_CODES) {
        throw new Error(`Count must be a whole number between 1 and ${MAX_BATCH_REDEEM_CODES}`);
    }
    const codeLength = body.CodeLength ?? 16;
    if (
        typeof codeLength != "number" ||
        !Number.isInteger(codeLength) ||
        codeLength < MIN_CODE_LENGTH ||
        codeLength > MAX_REDEEM_CODE_LENGTH
    ) {
        throw new Error(`CodeLength must be a whole number between ${MIN_CODE_LENGTH} and ${MAX_REDEEM_CODE_LENGTH}`);
    }
    const prefix = typeof body.Prefix == "string" ? body.Prefix.trim().toUpperCase() : "";
    if (prefix && !/^[A-Z0-9-]{1,24}$/.test(prefix)) {
        throw new Error("Prefix may only contain letters, digits, and hyphens");
    }

    const template: IRedeemCode = {
        // Empty Code tells the service to generate a random one.
        Code: "",
        Label: typeof body.Label == "string" && body.Label ? body.Label : undefined,
        Rewards: parseRewards(body.Rewards),
        ExpiresAt: parseExpiresAt(body.ExpiresAt),
        MaxUses: parseMaxUses(body.MaxUses),
        Uses: 0,
        UsedBy: [],
        Enabled: body.Enabled !== false,
        CreatedBy: account.DisplayName
    };

    const specs: IRedeemCode[] = [];
    for (let i = 0; i < count; i++) {
        // The service owns the alphabet, so a prefixed code is built from the same generator rather than a copy.
        specs.push({ ...template, Code: prefix ? `${prefix}${generateCode(codeLength)}` : "" });
    }
    res.json({ codes: await createRedeemCodes(specs, codeLength) });
};

export const deleteRedeemCodeController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const body = req.body as { Code?: unknown };
    if (typeof body.Code != "string") throw new Error("Invalid Code");
    res.json({ deleted: await deleteRedeemCode(body.Code) });
};

// Player-facing. Deliberately not admin-only: any logged-in account may redeem a code.
export const redeemCodeController: RequestHandler = async (req, res) => {
    const body = req.body as { codeId?: unknown };
    if (typeof body.codeId != "string" || !body.codeId.trim()) {
        res.status(400).send("INVALID_CODE").end();
        return;
    }
    const accountId = await getAccountIdForRequest(req);
    const result = await redeemCode(body.codeId, accountId);
    if (!result.ok) {
        res.status(400).send(result.reason).end();
        return;
    }

    const inventory = await getInventory(accountId, undefined);
    const inventoryChanges = await addItems(inventory, result.rewards, {});
    const modifiedPaths = inventory.modifiedPaths();
    if (modifiedPaths.length) {
        await inventory.save();
        broadcastInventoryUpdate(req);
    }
    res.json({
        InventoryChanges: inventoryChanges,
        Code: result.code.Code,
        Rewards: result.code.Rewards
    });
};

const findRedeemCode = async (code: string): Promise<IRedeemCode | undefined> => {
    return (await listRedeemCodes()).find(x => x.Code == code);
};
