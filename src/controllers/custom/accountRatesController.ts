import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { parseAccountRateProfile } from "../../services/accountRateService.ts";
import {
    deleteAccountRates,
    findAccountForRates,
    listAccountRates,
    saveAccountRates
} from "../../services/accountRateAdminService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { sendWsBroadcastEx } from "../../services/wsService.ts";

const requireAdministrator = async (
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1]
): Promise<boolean> => {
    let account;
    try {
        account = await getAccountForRequest(req);
    } catch {
        res.status(401).end();
        return false;
    }
    if (!isAdministrator(account)) {
        res.status(401).end();
        return false;
    }
    return true;
};

export const getAccountRatesController: RequestHandler = async (req, res) => {
    if (!(await requireAdministrator(req, res))) return;

    res.json(await listAccountRates());
};

export const saveAccountRatesController: RequestHandler = async (req, res) => {
    if (!(await requireAdministrator(req, res))) return;

    const body = req.body as { accountId?: unknown; profile?: unknown } | undefined;
    if (typeof body?.accountId != "string" || !Types.ObjectId.isValid(body.accountId)) {
        res.status(400).send("A valid accountId is required");
        return;
    }
    const account = await findAccountForRates(body.accountId);
    if (!account) {
        res.status(404).send("Account not found");
        return;
    }

    let profile;
    try {
        profile = parseAccountRateProfile(body.profile);
    } catch (error) {
        res.status(400).send((error as Error).message);
        return;
    }
    const saved = await saveAccountRates(account, profile);
    sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
    res.json(saved);
};

export const deleteAccountRatesController: RequestHandler = async (req, res) => {
    if (!(await requireAdministrator(req, res))) return;

    const body = req.body as { accountId?: unknown } | undefined;
    if (typeof body?.accountId != "string" || !Types.ObjectId.isValid(body.accountId)) {
        res.status(400).send("A valid accountId is required");
        return;
    }
    const account = await findAccountForRates(body.accountId);
    if (!account) {
        res.status(404).send("Account not found");
        return;
    }
    await deleteAccountRates(account);
    sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
    res.end();
};
