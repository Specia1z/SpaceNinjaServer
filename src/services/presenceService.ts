import type { Types } from "mongoose";
import {
    PlayerPresence,
    PlayerPresenceEvent,
    type IPlayerPresence,
    type TPresenceState
} from "../models/presenceModel.ts";
import { getRegion } from "./itemDataService.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import { logger } from "../utils/logger.ts";

type PresencePatch = Partial<Omit<IPlayerPresence, "AccountId" | "DisplayName" | "LastSeenAt" | "UpdatedAt">>;

const eventFields = ["Online", "State", "SessionId", "Node", "MissionStatus"] as const;

const ignorePresenceErrors = async (operation: string, action: () => Promise<void>): Promise<void> => {
    try {
        await action();
    } catch (error) {
        logger.warn(`[presence] ${operation} failed`, {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

const savePresence = async (
    accountId: Types.ObjectId,
    displayName: string,
    patch: PresencePatch,
    type: string,
    details?: Record<string, unknown>
): Promise<IPlayerPresence> => {
    const now = new Date();
    const current = await PlayerPresence.findOne({ AccountId: accountId });
    const next =
        current ??
        new PlayerPresence({
            AccountId: accountId,
            DisplayName: displayName,
            Online: false,
            State: "offline" as TPresenceState,
            LastSeenAt: now,
            UpdatedAt: now
        });
    const changed =
        !current || eventFields.some(field => patch[field] !== undefined && patch[field] !== current[field]);
    next.DisplayName = displayName || next.DisplayName;
    Object.assign(next, patch, { LastSeenAt: now, UpdatedAt: now });
    await next.save();
    if (changed || type == "mission") {
        await PlayerPresenceEvent.create({
            AccountId: accountId,
            DisplayName: next.DisplayName,
            Type: type,
            State: next.State,
            Online: next.Online,
            Node: next.Node,
            NodeName: next.NodeName,
            Planet: next.Planet,
            SessionId: next.SessionId,
            MissionStatus: next.MissionStatus,
            Details: details,
            CreatedAt: now
        });
    }
    return next;
};

export const initializePresence = (): Promise<void> =>
    ignorePresenceErrors("initialize", async () => {
        const now = new Date();
        const stale = await PlayerPresence.find({ Online: true }, "AccountId DisplayName State");
        if (!stale.length) return;
        await PlayerPresence.updateMany(
            { Online: true },
            { $set: { Online: false, State: "offline", LastLogoutAt: now, UpdatedAt: now } }
        );
        await PlayerPresenceEvent.insertMany(
            stale.map(presence => ({
                AccountId: presence.AccountId,
                DisplayName: presence.DisplayName,
                Type: "server_restart",
                State: "offline",
                Online: false,
                Details: { previousState: presence.State },
                CreatedAt: now
            }))
        );
    });

export const markPresenceLogin = async (
    accountId: Types.ObjectId,
    displayName: string,
    buildLabel?: string,
    platform?: number
): Promise<void> =>
    ignorePresenceErrors("login", async () => {
        await savePresence(
            accountId,
            displayName,
            {
                Online: true,
                State: "authenticating",
                BuildLabel: buildLabel,
                Platform: platform,
                LastLoginAt: new Date()
            },
            "login"
        );
    });

export const markPresenceOnline = (accountId: Types.ObjectId, displayName: string): Promise<void> =>
    ignorePresenceErrors("game_connected", async () => {
        await savePresence(accountId, displayName, { Online: true, State: "online" }, "game_connected");
    });

export const markPresenceOffline = (accountId: Types.ObjectId, displayName: string, reason: string): Promise<void> =>
    ignorePresenceErrors(reason, async () => {
        await savePresence(
            accountId,
            displayName,
            { Online: false, State: "offline", LastLogoutAt: new Date() },
            reason
        );
    });

export const markPresenceSession = async (
    accountId: Types.ObjectId,
    sessionId: string,
    session: { role?: string; gameModeId?: number; regionId?: number; map?: string; memberCount?: number }
): Promise<void> =>
    ignorePresenceErrors("session", async () => {
        const current = await PlayerPresence.findOne({ AccountId: accountId }, "DisplayName");
        await savePresence(
            accountId,
            current?.DisplayName ?? "",
            {
                Online: true,
                State: "lobby",
                SessionId: sessionId,
                SessionRole: session.role,
                SessionGameModeId: session.gameModeId,
                SessionRegionId: session.regionId,
                SessionMap: session.map,
                SessionMemberCount: session.memberCount
            },
            "session"
        );
    });

export const clearPresenceSession = (accountId: Types.ObjectId, sessionId: string): Promise<void> =>
    ignorePresenceErrors("session_closed", async () => {
        const current = await PlayerPresence.findOne({ AccountId: accountId }, "DisplayName Online");
        if (!current || current.SessionId != sessionId) return;
        await savePresence(
            accountId,
            current.DisplayName,
            {
                Online: current.Online,
                State: current.Online ? "online" : "offline",
                SessionId: undefined,
                SessionRole: undefined,
                SessionGameModeId: undefined,
                SessionRegionId: undefined,
                SessionMap: undefined,
                SessionMemberCount: undefined
            },
            "session_closed"
        );
    });

export const markPresenceMission = async (
    accountId: Types.ObjectId,
    displayName: string,
    buildLabel: string,
    report: IMissionInventoryUpdateRequest
): Promise<void> =>
    ignorePresenceErrors("mission", async () => {
        const node = report.RewardInfo?.node ?? report.Missions?.Tag;
        const region = node ? await getRegion(node, buildLabel) : undefined;
        const terminal = Boolean(report.MissionStatus) || report.MissionFailed === true;
        await savePresence(
            accountId,
            displayName,
            {
                Online: true,
                State: terminal ? "online" : "mission",
                BuildLabel: buildLabel,
                Node: node,
                NodeName: region?.name,
                Planet: region?.systemName,
                MissionStatus: report.MissionStatus,
                MissionType: region?.missionName ?? report.Missions?.Tag,
                MissionTime: report.MissionTime,
                AliveTime: report.AliveTime,
                LastMissionAt: new Date()
            },
            terminal ? "mission_complete" : "mission"
        );
    });
