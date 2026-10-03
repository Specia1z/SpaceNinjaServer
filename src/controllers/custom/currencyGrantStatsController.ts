import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { getCurrencyGrantStats } from "../../services/currencyGrantStatService.ts";

export const getCurrencyGrantStatsController: RequestHandler = async (req, res) => {
    let account;
    try {
        account = await getAccountForRequest(req);
    } catch {
        res.status(401).end();
        return;
    }
    if (!isAdministrator(account)) {
        res.status(401).end();
        return;
    }

    const day = typeof req.query.day == "string" ? req.query.day : undefined;
    try {
        res.json(await getCurrencyGrantStats(day));
    } catch (error) {
        if (error instanceof Error && error.message == "day must be an ISO date (YYYY-MM-DD)") {
            res.status(400).send(error.message);
            return;
        }
        throw error;
    }
};
