import { GuildMember } from "../../models/guildModel.ts";
import { clanLockCheats } from "../../services/clanCheatsService.ts";
import { getGuildForRequest } from "../../services/guildService.ts";
import { getAccountForRequest, hasPermission } from "../../services/loginService.ts";
import { broadcastGuildUpdate } from "../../services/wsService.ts";
import { isGuildCheatKey } from "../../types/guildTypes.ts";
import type { RequestHandler } from "express";

export const setGuildCheatController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const payload = req.body as { key?: unknown; value?: unknown } | null | undefined;
    const key = payload?.key;
    const value = payload?.value;
    if (typeof key != "string" || !isGuildCheatKey(key) || typeof value != "boolean") {
        res.status(400).send("Invalid guild cheat payload");
        return;
    }
    if (!hasPermission(account, `toggleCheat.${key}`)) {
        res.status(403).send("Permission denied");
        return;
    }
    const accountId = account._id.toString();
    const guild = await getGuildForRequest(req, accountId);
    const member = await GuildMember.findOne({ accountId: accountId, guildId: guild._id });

    if (member && member.rank <= 1) {
        const meta = value ? clanLockCheats[key] : undefined;

        guild[key] = value;
        await guild.save();
        broadcastGuildUpdate(req, guild._id.toString());

        if (meta && !meta.isGuildInIdealState(guild)) {
            res.send("retroactivable");
        }
    }
    res.end();
};
