import { randomBytes } from "node:crypto";
import { RedeemCode, type IRedeemCode } from "../models/redeemCodeModel.ts";
import type { ITypeCount } from "../types/commonTypes.ts";

// Codes are compared and stored uppercase so players can type them in any case.
const normalizeCode = (code: string): string => code.trim().toUpperCase();

// Unambiguous alphabet: no 0/O, 1/I/L, so a code read off a screen is hard to mistype.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const generateCode = (length: number): string => {
    let code = "";
    // Rejection sampling keeps every character equally likely even though 256 is not a multiple of the alphabet size.
    while (code.length < length) {
        for (const byte of randomBytes(length)) {
            if (byte >= Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length) continue;
            code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
            if (code.length == length) break;
        }
    }
    return code;
};

// Codes live in Mongo so that a redemption survives a restart and cannot be replayed, but the hot redemption path
// is a Map lookup rather than a query.
const redeemCodes = new Map<string, IRedeemCode>();

export const initializeRedeemCodes = async (): Promise<void> => {
    redeemCodes.clear();
    for (const code of await RedeemCode.find().lean()) {
        redeemCodes.set(code.Code, code);
    }
};

export const listRedeemCodes = async (): Promise<IRedeemCode[]> => {
    return RedeemCode.find().sort({ Code: 1 }).lean();
};

export const saveRedeemCode = async (code: IRedeemCode): Promise<IRedeemCode> => {
    const normalized = { ...code, Code: normalizeCode(code.Code) };
    const saved = await RedeemCode.findOneAndUpdate({ Code: normalized.Code }, normalized, {
        upsert: true,
        returnDocument: "after",
        runValidators: true
    }).lean();
    redeemCodes.set(saved!.Code, saved!);
    return saved!;
};

export const deleteRedeemCode = async (code: string): Promise<boolean> => {
    const normalized = normalizeCode(code);
    const result = await RedeemCode.deleteOne({ Code: normalized });
    redeemCodes.delete(normalized);
    return result.deletedCount > 0;
};

// Adds codes that are missing from the collection and leaves existing ones untouched, so re-running a batch
// generation never invalidates codes that were already handed out.
export const createRedeemCodes = async (specs: readonly IRedeemCode[], codeLength: number): Promise<IRedeemCode[]> => {
    const taken = new Set(redeemCodes.keys());
    const created: IRedeemCode[] = [];
    for (const spec of specs) {
        if (spec.Code) {
            const normalized = normalizeCode(spec.Code);
            if (taken.has(normalized) || (await RedeemCode.exists({ Code: normalized }))) {
                throw new Error(`Redeem code ${normalized} already exists`);
            }
            taken.add(normalized);
            created.push(await saveRedeemCode({ ...spec, Code: normalized }));
            continue;
        }
        // Retry in the (very unlikely) event of a collision with an existing code.
        let attempt = 0;
        for (;;) {
            const code = generateCode(codeLength);
            if (taken.has(code) || (await RedeemCode.exists({ Code: code }))) {
                if (++attempt > 20) throw new Error("Unable to generate a unique redeem code");
                continue;
            }
            taken.add(code);
            created.push(await saveRedeemCode({ ...spec, Code: code }));
            break;
        }
    }
    return created;
};

export type TRedeemResult =
    | { ok: true; code: IRedeemCode; rewards: ITypeCount[] }
    | { ok: false; reason: "INVALID_CODE" | "EXPIRED_CODE" | "USED_CODE" | "EXHAUSTED_CODE" };

export const redeemCode = async (rawCode: string, accountId: string): Promise<TRedeemResult> => {
    const code = normalizeCode(rawCode);
    const entry = redeemCodes.get(code);
    if (!entry) {
        return { ok: false, reason: "INVALID_CODE" };
    }
    if (!entry.Enabled) {
        return { ok: false, reason: "INVALID_CODE" };
    }
    if (entry.ExpiresAt && entry.ExpiresAt.getTime() <= Date.now()) {
        return { ok: false, reason: "EXPIRED_CODE" };
    }
    if (entry.MaxUses > 0 && entry.Uses >= entry.MaxUses) {
        return { ok: false, reason: "EXHAUSTED_CODE" };
    }
    if (entry.UsedBy.some(id => String(id) == accountId)) {
        return { ok: false, reason: "USED_CODE" };
    }

    // The atomic update is what actually enforces the per-account limit: the filter rejects a second redemption
    // by the same account, so two concurrent requests from one account cannot both win.
    const updated = await RedeemCode.findOneAndUpdate(
        {
            Code: code,
            Enabled: true,
            UsedBy: { $ne: accountId },
            $or: [{ ExpiresAt: { $exists: false } }, { ExpiresAt: { $gt: new Date() } }]
        },
        {
            $push: { UsedBy: accountId },
            $inc: { Uses: 1 }
        },
        { returnDocument: "after", runValidators: true }
    ).lean();

    if (!updated) {
        // The document exists, so the failure is a per-account or expiry issue rather than an unknown code.
        return { ok: false, reason: "USED_CODE" };
    }

    redeemCodes.set(updated.Code, updated);
    return { ok: true, code: updated, rewards: updated.Rewards };
};
