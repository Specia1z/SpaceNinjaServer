import type { RequestHandler } from "express";
import { config } from "../../services/configService.ts";
import {
    getNewAccountWelcomeConfig,
    normalizeNewAccountWelcomeConfig
} from "../../services/newAccountWelcomeService.ts";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { saveConfig } from "../../services/configWriterService.ts";
import { sendWsBroadcastEx } from "../../services/wsService.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

export const getAdminFeaturesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json({ newAccountWelcome: getNewAccountWelcomeConfig() });
};

export const saveAdminFeaturesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const body = req.body as Record<string, unknown>;
    try {
        const newAccountWelcome = normalizeNewAccountWelcomeConfig(body.newAccountWelcome ?? body);
        config.playwfFeatures ??= {};
        config.playwfFeatures.newAccountWelcome = newAccountWelcome;
        await saveConfig();
        sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
        res.json({ newAccountWelcome });
    } catch (error) {
        res.status(400).send((error as Error).message);
    }
};
