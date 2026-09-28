import type { RequestHandler } from "express";
import { updateSession } from "../../services/sessionService.ts";
import { getAccountForRequest } from "../../services/loginService.ts";

export const updateSessionGetController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!(await updateSession(req.query.sessionId as string, undefined, account._id))) {
        res.status(400);
    }
    res.json({});
};

export const updateSessionPostController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!(await updateSession(req.query.sessionId as string, String(req.body), account._id))) {
        res.status(400);
    }
    res.json({});
};
