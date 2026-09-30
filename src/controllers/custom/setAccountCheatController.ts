import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import type { RequestHandler } from "express";

export const setAccountCheatController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }
    res.status(410).send("Account cheats are server-wide. Use /custom/setConfig with an accountCheats.* key.");
};
