import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Account } from "../../models/loginModel.ts";
import { deleteAccountData } from "../../services/accountDeletionService.ts";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { sendWsBroadcastTo } from "../../services/wsService.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

export const deleteAccountController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    await deleteAccountData(account);
    sendWsBroadcastTo(account._id.toString(), { logged_out: true });
    res.end();
};

export const deleteAdminAccountController: RequestHandler = async (req, res) => {
    const administrator = await getAdministrator(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const accountId = body.accountId;
    if (typeof accountId != "string" || !Types.ObjectId.isValid(accountId)) {
        res.status(400).send("A valid accountId is required");
        return;
    }

    const account = await Account.findById(accountId);
    if (!account) {
        res.status(404).send("Account not found");
        return;
    }
    if (account._id.equals(administrator._id)) {
        res.status(400).send("Use the account deletion action to delete your own account");
        return;
    }
    if (isAdministrator(account)) {
        res.status(403).send("Administrators cannot be deleted by another administrator");
        return;
    }

    await deleteAccountData(account);
    sendWsBroadcastTo(account._id.toString(), { logged_out: true });
    res.json({ deleted: true, accountId: account._id.toString() });
};
