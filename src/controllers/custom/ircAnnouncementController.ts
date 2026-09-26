import type { RequestHandler } from "express";
import { isValidIrcAnnouncement, sendIrcAnnouncement } from "../../services/ircAnnouncementService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";

export const ircAnnouncementController: RequestHandler = async (req, res) => {
    let account;
    try {
        account = await getAccountForRequest(req);
    } catch {
        res.status(401).end();
        return;
    }
    if (!isAdministrator(account)) {
        res.status(403).end();
        return;
    }

    const message = (req.body as { message?: unknown } | undefined)?.message;
    if (!isValidIrcAnnouncement(message)) {
        res.status(400).send("Announcement must be a single line of 1–400 UTF-8 bytes");
        return;
    }

    try {
        await sendIrcAnnouncement(message);
        res.json({ submitted: true });
    } catch (error) {
        console.error("Failed to send IRC announcement:", error);
        res.status(502).send("IRC announcement service is unavailable");
    }
};
