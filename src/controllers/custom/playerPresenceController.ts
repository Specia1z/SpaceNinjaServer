import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Account } from "../../models/loginModel.ts";
import { PlayerPresence, PlayerPresenceEvent } from "../../models/presenceModel.ts";
import { Session } from "../../models/sessionModel.ts";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { getDict, getRegions, getString } from "../../services/itemDataService.ts";

const MAX_PLAYERS = 2000;
const MAX_EVENTS = 200;

const requireAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

const localize = (value: string | undefined, dict: Record<string, string>): string | undefined =>
    value ? getString(value, dict) : undefined;

const localizePresence = <T extends { NodeName?: string; Planet?: string; MissionType?: string }>(
    presence: T,
    dict: Record<string, string>
): T => ({
    ...presence,
    NodeName: localize(presence.NodeName, dict),
    Planet: localize(presence.Planet, dict),
    MissionType: localize(presence.MissionType, dict)
});

const getPresenceDictionary = (req: Parameters<RequestHandler>[0], account: TAccountDocument): Record<string, string> =>
    getDict(typeof req.query.lang == "string" ? req.query.lang : (account.Language ?? "en"));

const sessionState = (
    session: {
        _id: Types.ObjectId;
        creatorId: Types.ObjectId;
        gameModeId: number;
        regionId: number;
        maps: string[];
        members: { accountId: Types.ObjectId }[];
    },
    accountId: Types.ObjectId
): {
    SessionId: string;
    SessionRole: string;
    SessionGameModeId: number;
    SessionRegionId: number;
    SessionMap: string;
    SessionMemberCount: number;
} => ({
    SessionId: session._id.toString(),
    SessionRole: accountId.equals(session.creatorId) ? "host" : "member",
    SessionGameModeId: session.gameModeId,
    SessionRegionId: session.regionId,
    SessionMap: session.maps.join(", "),
    SessionMemberCount: session.members.length
});

export const listPlayerPresenceController: RequestHandler = async (req, res) => {
    const administrator = await requireAdministrator(req);
    const dict = getPresenceDictionary(req, administrator);
    const search = typeof req.query.search == "string" ? req.query.search.trim() : "";
    const limit = Math.min(MAX_PLAYERS, Math.max(1, parseInt(String(req.query.limit ?? "500")) || 500));
    const accountFilter = search
        ? { DisplayName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
        : {};
    const accounts = await Account.find(
        accountFilter,
        "DisplayName ClientType BuildLabel LastLogin LastPlatform Dropped Banned"
    )
        .sort({ LastLogin: -1 })
        .limit(limit)
        .lean();
    const ids = accounts.map(account => account._id);
    const [presences, sessions] = await Promise.all([
        PlayerPresence.find({ AccountId: { $in: ids } }).lean(),
        Session.find({ "members.accountId": { $in: ids }, lastUpdate: { $gte: new Date(Date.now() - 5 * 60 * 1000) } })
            .select("creatorId gameModeId regionId maps members _id lastUpdate")
            .lean()
    ]);
    const presenceById = new Map(presences.map(presence => [presence.AccountId.toString(), presence]));
    const legacyBuildLabels = new Set(
        presences
            .filter(presence => presence.MissionType?.startsWith("SolNode"))
            .map(presence => presence.BuildLabel)
            .filter((buildLabel): buildLabel is string => Boolean(buildLabel))
    );
    const regionsByBuild = new Map(
        await Promise.all(
            [...legacyBuildLabels].map(async buildLabel => [buildLabel, await getRegions(buildLabel)] as const)
        )
    );
    const sessionByAccount = new Map<string, ReturnType<typeof sessionState>>();
    for (const session of sessions) {
        for (const member of session.members) {
            sessionByAccount.set(member.accountId.toString(), sessionState(session, member.accountId));
        }
    }
    const players = accounts.map(account => {
        const id = account._id.toString();
        const presence = presenceById.get(id);
        const session = sessionByAccount.get(id);
        const legacyNode = presence?.Node ?? presence?.MissionType;
        const legacyRegion =
            presence?.BuildLabel && legacyNode ? regionsByBuild.get(presence.BuildLabel)?.[legacyNode] : undefined;
        return localizePresence(
            {
                AccountId: id,
                DisplayName: account.DisplayName,
                Online: presence?.Online ?? false,
                State: presence?.State ?? "offline",
                ClientType: account.ClientType,
                BuildLabel: presence?.BuildLabel ?? account.BuildLabel,
                Platform: presence?.Platform ?? account.LastPlatform,
                SessionId: session?.SessionId ?? presence?.SessionId,
                SessionRole: session?.SessionRole ?? presence?.SessionRole,
                SessionGameModeId: session?.SessionGameModeId ?? presence?.SessionGameModeId,
                SessionRegionId: session?.SessionRegionId ?? presence?.SessionRegionId,
                SessionMap: session?.SessionMap ?? presence?.SessionMap,
                SessionMemberCount: session?.SessionMemberCount ?? presence?.SessionMemberCount,
                Node: presence?.Node,
                NodeName: presence?.NodeName ?? legacyRegion?.name,
                Planet: presence?.Planet ?? legacyRegion?.systemName,
                MissionStatus: presence?.MissionStatus,
                MissionType: legacyRegion?.missionName ?? presence?.MissionType,
                MissionTime: presence?.MissionTime,
                AliveTime: presence?.AliveTime,
                LastMissionAt: presence?.LastMissionAt,
                LastLoginAt: presence?.LastLoginAt ?? account.LastLogin,
                LastLogoutAt: presence?.LastLogoutAt,
                LastSeenAt: presence?.LastSeenAt,
                UpdatedAt: presence?.UpdatedAt,
                Dropped: account.Dropped ?? false,
                Banned: account.Banned ?? false
            },
            dict
        );
    });
    players.sort(
        (left, right) =>
            Number(right.Online) - Number(left.Online) ||
            new Date(right.LastSeenAt ?? 0).getTime() - new Date(left.LastSeenAt ?? 0).getTime()
    );
    res.json({
        Players: players,
        Summary: {
            Total: players.length,
            Online: players.filter(player => player.Online).length,
            InMission: players.filter(player => player.State == "mission").length,
            InSession: players.filter(player => player.SessionId).length
        },
        GeneratedAt: new Date()
    });
};

export const getPlayerPresenceHistoryController: RequestHandler = async (req, res) => {
    const administrator = await requireAdministrator(req);
    const dict = getPresenceDictionary(req, administrator);
    const accountId = String(req.query.accountId ?? "");
    if (!Types.ObjectId.isValid(accountId)) throw new Error("Valid accountId is required");
    const limit = Math.min(MAX_EVENTS, Math.max(1, parseInt(String(req.query.limit ?? "50")) || 50));
    const events = await PlayerPresenceEvent.find({ AccountId: accountId }).sort({ CreatedAt: -1 }).limit(limit).lean();
    res.json({
        AccountId: accountId,
        Events: events.map(event =>
            localizePresence(
                {
                    Type: event.Type,
                    State: event.State,
                    Online: event.Online,
                    Node: event.Node,
                    NodeName: event.NodeName,
                    Planet: event.Planet,
                    SessionId: event.SessionId,
                    MissionStatus: event.MissionStatus,
                    Details: event.Details,
                    CreatedAt: event.CreatedAt
                },
                dict
            )
        )
    });
};

export const resolvePresenceNodesController: RequestHandler = async (req, res) => {
    const administrator = await requireAdministrator(req);
    const dict = getPresenceDictionary(req, administrator);
    const buildLabel = String(req.query.buildLabel ?? "");
    if (!buildLabel) {
        res.json({});
        return;
    }
    const regions = await getRegions(buildLabel);
    res.json(
        Object.fromEntries(
            Object.entries(regions).map(([key, region]) => [
                key,
                {
                    Name: getString(region.name, dict),
                    Planet: getString(region.systemName, dict),
                    MissionName: getString(region.missionName, dict),
                    SystemIndex: region.systemIndex,
                    NodeType: region.nodeType,
                    MinEnemyLevel: region.minEnemyLevel,
                    MaxEnemyLevel: region.maxEnemyLevel
                }
            ])
        )
    );
};
