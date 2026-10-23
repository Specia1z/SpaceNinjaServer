import type { RequestHandler, Response } from "express";
import { Types } from "mongoose";
import { Account } from "../../models/loginModel.ts";
import {
    InventoryRepairConflictError,
    previewMisclassifiedAugmentRepair,
    repairMisclassifiedAugmentInventory
} from "../../services/adminInventoryRepairService.ts";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { sendWsBroadcastToGame, sendWsBroadcastToWebui } from "../../services/wsService.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<boolean> => {
    const account = await getAccountForRequest(req);
    return isAdministrator(account);
};

const getTargetAccount = async (accountId: unknown, res: Response): Promise<TAccountDocument | undefined> => {
    if (typeof accountId != "string" || !Types.ObjectId.isValid(accountId)) {
        res.status(400).send("A valid accountId is required");
        return undefined;
    }

    const account: TAccountDocument | null = await Account.findById(accountId, "_id");
    if (!account) {
        res.status(404).send("Account not found");
        return undefined;
    }
    return account;
};

export const previewMisclassifiedAugmentRepairController: RequestHandler = async (req, res) => {
    if (!(await getAdministrator(req))) {
        res.status(403).send("Administrator permission required");
        return;
    }

    const account = await getTargetAccount(req.query.targetAccountId, res);
    if (!account) return;
    res.json(await previewMisclassifiedAugmentRepair(account._id.toString()));
};

export const repairMisclassifiedAugmentController: RequestHandler = async (req, res) => {
    if (!(await getAdministrator(req))) {
        res.status(403).send("Administrator permission required");
        return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const account = await getTargetAccount(body.accountId, res);
    if (!account) return;
    if (!Number.isSafeInteger(body.expectedCount) || (body.expectedCount as number) < 1) {
        res.status(400).send("A positive expectedCount is required");
        return;
    }

    try {
        const accountId = account._id.toString();
        const result = await repairMisclassifiedAugmentInventory(accountId, body.expectedCount as number);
        sendWsBroadcastToGame(accountId, { sync_inventory: true });
        sendWsBroadcastToWebui({ update_inventory: true }, accountId);
        res.json(result);
    } catch (error) {
        if (error instanceof InventoryRepairConflictError) {
            res.status(409).send(error.message);
            return;
        }
        throw error;
    }
};
