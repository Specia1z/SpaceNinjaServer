import type { RequestHandler } from "express";
import { getAccountForRequest, hasPermission } from "../../services/loginService.ts";
import { clanLockCheats } from "../../services/clanCheatsService.ts";
import { isGuildCheatKey } from "../../types/guildTypes.ts";
import { getGuildForRequest } from "../../services/guildService.ts";
import { GuildMember } from "../../models/guildModel.ts";
import { broadcastControlMessages } from "../../services/arbiterService.ts";

export const retroactivelyApplyGuildCheatController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const cheat = typeof req.query.cheat == "string" ? req.query.cheat : undefined;
    if (!cheat || !isGuildCheatKey(cheat)) {
        res.status(400).send("Invalid guild cheat");
        return;
    }
    if (!hasPermission(account, `toggleCheat.${cheat}`)) {
        res.status(403).send("Permission denied");
        return;
    }
    const accountId = account._id.toString();
    const guild = await getGuildForRequest(req, accountId);
    const member = await GuildMember.findOne({ accountId: accountId, guildId: guild._id });
    if (member && member.rank <= 1) {
        const meta = clanLockCheats[cheat];
        if (!meta) {
            res.status(400).send("Guild cheat is not retroactive");
            return;
        }
        const msgs = await meta.cleanupGuild(guild);
        if (!meta.isGuildInIdealState(guild)) {
            throw new Error(`cleanupGuild for ${cheat} does not satisfy its isGuildInIdealState`);
        }
        await guild.save();
        if (msgs.length) {
            broadcastControlMessages(`${guild._id.toString().toUpperCase()}_0`, msgs);
        }
    }
    res.end();
};
