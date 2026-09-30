import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";

export const retroactivelyApplyCheatController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }
    res.status(410).send("Account cheats are server-wide and are cleaned up when enabled in server settings.");
};
