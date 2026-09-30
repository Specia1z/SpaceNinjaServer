import { Session } from "../models/sessionModel.ts";
import { generateRewardSeed } from "./rngService.ts";
import type {
    ISession,
    IFindSessionRequest,
    IFindSessionResponseSession,
    IHostSessionRequest,
    IMatchmakingSessionRequest,
    ISessionDatabase,
    TSessionSlotType
} from "../types/sessionTypes.ts";
import { logger } from "../utils/logger.ts";
import { JSONParse } from "json-with-bigint";
import { Types, type QueryFilter } from "mongoose";
import { clearPresenceSession, markPresenceSession } from "./presenceService.ts";

//const sessions: ISession[] = [];

export const createNewSession = async (
    sessionData: IHostSessionRequest,
    Creator: Types.ObjectId
): Promise<ISession> => {
    const newSession: ISessionDatabase = {
        _id: new Types.ObjectId(),
        ...sessionData,
        creatorId: Creator,
        members: [{ accountId: Creator, slotType: "host" }],
        //maxPlayers: sessionData.maxPlayers ?? 4,
        //minPlayers: sessionData.minPlayers ?? 1,
        //privateSlots: sessionData.privateSlots ?? 0,
        //scoreLimit: sessionData.scoreLimit ?? 15,
        //timeLimit: sessionData.timeLimit ?? 900,
        //gameModeId: sessionData.gameModeId ?? 0,
        //eloRating: sessionData.eloRating ?? 3,
        //regionId: sessionData.regionId ?? 3,
        //difficulty: sessionData.difficulty ?? 0,
        hasStarted: sessionData.hasStarted ?? false,
        //enableVoice: sessionData.enableVoice ?? true,
        //matchType: sessionData.matchType ?? "NORMAL",
        //maps: sessionData.maps ?? [],
        //originalSessionId: sessionData.originalSessionId ?? "",
        //customSettings: sessionData.customSettings ?? "",
        rewardSeed: sessionData.rewardSeed || -1,
        //guildId: sessionData.guildId ?? "",
        //buildId: sessionData.buildId ?? 4920386201513015989n,
        //platform: sessionData.platform ?? Platform.Windows,
        //xplatform: sessionData.xplatform ?? false,
        //freePublic: sessionData.freePublic ?? 3,
        //freePrivate: sessionData.freePrivate ?? 0,
        fullReset: 0,

        lastUpdate: new Date()
    };
    if (newSession.rewardSeed == -1) {
        newSession.rewardSeed = generateRewardSeed();
    }

    await Session.create(newSession);
    await markPresenceSession(Creator, newSession._id.toString(), {
        role: "host",
        gameModeId: newSession.gameModeId,
        regionId: newSession.regionId,
        map: newSession.maps.join(", "),
        memberCount: newSession.members.length
    });
    //sessions.push(newSession);

    return newSession;
};

export const getSessionByID = async (sessionId: string | Types.ObjectId): Promise<ISessionDatabase | null> => {
    return await Session.findById(sessionId);
};

type IRankableSession = Pick<
    ISessionDatabase,
    "_id" | "eloRating" | "maxPlayers" | "freePublic" | "freePrivate" | "lastUpdate"
>;

export const buildMatchmakingQuery = (request: IMatchmakingSessionRequest): QueryFilter<ISessionDatabase> => {
    const query: QueryFilter<ISessionDatabase> = {
        buildId: request.buildId,
        gameModeId: request.gameModeId,
        regionId: request.regionId,
        freePublic: { $gte: 1 }
    };
    if (request.allowJIP === false) {
        query.hasStarted = false;
    }
    if (request.enforceElo === true && request.eloRating !== undefined && request.maxEloDifference !== undefined) {
        query.eloRating = {
            $gte: request.eloRating - request.maxEloDifference,
            $lte: request.eloRating + request.maxEloDifference
        };
    }
    if (request.maps) {
        query.maps = request.maps;
    }
    if (request.platform !== undefined) {
        if (request.xplatform === true) {
            query.$or = [{ xplatform: true }, { platform: request.platform }];
        } else {
            query.platform = request.platform;
        }
    }
    return query;
};

export const rankSessionCandidates = <T extends IRankableSession>(
    sessions: readonly T[],
    request: IMatchmakingSessionRequest
): T[] => {
    return [...sessions].sort((left, right) => {
        if (request.eloRating !== undefined) {
            const leftDifference = Math.abs((left.eloRating ?? request.eloRating) - request.eloRating);
            const rightDifference = Math.abs((right.eloRating ?? request.eloRating) - request.eloRating);
            if (leftDifference != rightDifference) {
                return leftDifference - rightDifference;
            }
        }

        const leftPlayers = Math.max(0, left.maxPlayers - left.freePublic - left.freePrivate);
        const rightPlayers = Math.max(0, right.maxPlayers - right.freePublic - right.freePrivate);
        if (leftPlayers != rightPlayers) {
            return rightPlayers - leftPlayers;
        }

        const freshness = right.lastUpdate.getTime() - left.lastUpdate.getTime();
        if (freshness != 0) {
            return freshness;
        }
        return left._id.toString().localeCompare(right._id.toString());
    });
};

export const getSession = async (request: IFindSessionRequest): Promise<IFindSessionResponseSession[]> => {
    const query: QueryFilter<ISessionDatabase> = {};
    if ("id" in request) {
        query._id = request.id;
    } else if ("originalSessionId" in request) {
        query.originalSessionId = request.originalSessionId;
    } else {
        Object.assign(query, buildMatchmakingQuery(request));
    }
    const sessions = await Session.find(
        query,
        "creatorId eloRating maxPlayers freePublic freePrivate lastUpdate"
    );
    const rankedSessions = "id" in request || "originalSessionId" in request ? sessions : rankSessionCandidates(sessions, request);
    return rankedSessions.map(session => ({
        createdBy: session.creatorId.toString(),
        id: session._id.toString()
    }));

    /*return sessions
        .filter(session => {
            if ("id" in request) {
                return session._id.equals(request.id);
            } else if ("originalSessionId" in request) {
                return session._id.equals(request.originalSessionId);
            } else {
                return (
                    !session.hasStarted &&
                    request.buildId == session.buildId &&
                    request.gameModeId == session.gameModeId &&
                    (!request.freePublic || session.freePublic >= 1) &&
                    session.regionId == request.regionId &&
                    Math.abs(session.eloRating - request.eloRating) <= request.maxEloDifference &&
                    (!request.maps || session.maps.indexOf(request.maps) != -1)
                );
            }
        })
        .map(session => ({
            createdBy: session.creatorId.toString(),
            id: session._id.toString()
        }));*/
};

const findExistingMembership = async (
    sessionId: string,
    accountId: Types.ObjectId
): Promise<ISessionDatabase | null> => {
    return await Session.findOne({ _id: sessionId, "members.accountId": accountId });
};

const reserveSlot = async (
    sessionId: string,
    accountId: Types.ObjectId,
    slotType: Exclude<TSessionSlotType, "host">
): Promise<ISessionDatabase | null> => {
    const slotField = slotType === "public" ? "freePublic" : "freePrivate";
    return await Session.findOneAndUpdate(
        {
            _id: sessionId,
            [slotField]: { $gte: 1 },
            "members.accountId": { $ne: accountId }
        },
        {
            $inc: { [slotField]: -1 },
            $push: { members: { accountId, slotType } },
            $set: { lastUpdate: new Date() }
        },
        { returnDocument: "after" }
    );
};

export const reserveSessionSlot = async (
    sessionIds: readonly string[],
    accountId: Types.ObjectId
): Promise<ISessionDatabase | null> => {
    const recordMembers = async (session: ISessionDatabase): Promise<void> => {
        await Promise.all(
            session.members.map(member =>
                markPresenceSession(member.accountId, session._id.toString(), {
                    role: member.accountId.equals(session.creatorId) ? "host" : member.slotType,
                    gameModeId: session.gameModeId,
                    regionId: session.regionId,
                    map: session.maps.join(", "),
                    memberCount: session.members.length
                })
            )
        );
    };
    for (const sessionId of sessionIds) {
        const existingMembership = await findExistingMembership(sessionId, accountId);
        if (existingMembership) {
            await recordMembers(existingMembership);
            return existingMembership;
        }
        const publicSession = await reserveSlot(sessionId, accountId, "public");
        if (publicSession) {
            await recordMembers(publicSession);
            return publicSession;
        }
        const privateSession = await reserveSlot(sessionId, accountId, "private");
        if (privateSession) {
            await recordMembers(privateSession);
            return privateSession;
        }
        const concurrentMembership = await findExistingMembership(sessionId, accountId);
        if (concurrentMembership) {
            await recordMembers(concurrentMembership);
            return concurrentMembership;
        }
    }
    return null;
};

const releaseSessionSlot = async (
    sessionId: string | Types.ObjectId,
    creatorId: Types.ObjectId,
    memberAccountId: Types.ObjectId
): Promise<boolean> => {
    const session = await Session.findOne(
        { _id: sessionId, creatorId, "members.accountId": memberAccountId },
        "members"
    );
    const member = session?.members.find(candidate => candidate.accountId.equals(memberAccountId));
    if (!member || member.slotType === "host") {
        return false;
    }
    const slotField = member.slotType === "public" ? "freePublic" : "freePrivate";
    const updated = await Session.findOneAndUpdate(
        {
            _id: sessionId,
            creatorId,
            members: { $elemMatch: { accountId: memberAccountId, slotType: member.slotType } }
        },
        {
            $inc: { [slotField]: 1 },
            $pull: { members: { accountId: memberAccountId } },
            $set: { lastUpdate: new Date() }
        },
        { returnDocument: "after" }
    );
    if (updated) {
        await clearPresenceSession(memberAccountId, String(sessionId));
    }
    return updated != null;
};

export const updateSession = async (
    sessionId: string | Types.ObjectId,
    updateData: string | undefined,
    creatorId: Types.ObjectId
): Promise<boolean> => {
    //const session = sessions.find(session => session._id.equals(sessionId));
    let parsedUpdate: Record<string, unknown> | undefined;
    if (updateData?.substring(0, 1) == "{") {
        try {
            parsedUpdate = JSONParse(updateData) as Record<string, unknown>;
        } catch (error) {
            logger.error("Invalid JSON string for session update.");
            return false;
        }

        const releasesSlot =
            Number(parsedUpdate.freePublicInc ?? 0) > 0 || Number(parsedUpdate.freePrivateInc ?? 0) > 0;
        if (typeof parsedUpdate.memberAccountId === "string" && releasesSlot) {
            if (!Types.ObjectId.isValid(parsedUpdate.memberAccountId)) {
                logger.error(`Invalid session member account id: ${parsedUpdate.memberAccountId}`);
                return false;
            }
            const memberAccountId = new Types.ObjectId(parsedUpdate.memberAccountId);
            const released = await releaseSessionSlot(sessionId, creatorId, memberAccountId);
            if (!released) {
                logger.debug(`session member ${memberAccountId.toString()} was already released`);
            }
        }
        delete parsedUpdate.memberAccountId;
        delete parsedUpdate.freePublicInc;
        delete parsedUpdate.freePrivateInc;
        delete parsedUpdate.members;
        delete parsedUpdate.creatorId;
        delete parsedUpdate._id;
    }

    const session = await Session.findOne({ _id: sessionId, creatorId });
    if (!session) {
        return false;
    }

    if (updateData) {
        logger.debug(`session update: ${updateData}`);
        if (parsedUpdate) {
            Object.assign(session, parsedUpdate);
        } else {
            const updates: string[] = updateData.split("&");
            for (const update of updates) {
                const arr = update.split("=");
                if (arr.length == 2) {
                    const [key, value] = arr;
                    switch (key) {
                        case "maxPlayers":
                        case "minPlayers":
                        case "privateSlots":
                        case "scoreLimit":
                        case "timeLimit":
                        case "gameModeId":
                        case "eloRating":
                        case "regionId":
                        case "difficulty":
                        case "freePublic":
                        case "freePrivate":
                            session[key] = parseInt(value);
                            break;

                        default:
                            logger.error(`unexpected key in legacy session update format: ${key}`);
                            break;
                    }
                }
            }
        }
    }

    session.lastUpdate = new Date();
    logger.trace(`session after update:`, session);
    await session.save();
    await Promise.all(
        session.members.map(member =>
            markPresenceSession(member.accountId, session._id.toString(), {
                role: member.accountId.equals(session.creatorId) ? "host" : member.slotType,
                gameModeId: session.gameModeId,
                regionId: session.regionId,
                map: session.maps.join(", "),
                memberCount: session.members.length
            })
        )
    );

    return true;
};

export const deleteSession = async (
    sessionId: string | Types.ObjectId,
    creatorId: Types.ObjectId
): Promise<boolean> => {
    const session = await Session.findOne({ _id: sessionId, creatorId }, "members");
    const result = await Session.deleteOne({ _id: sessionId, creatorId });
    if (result.deletedCount == 1 && session) {
        await Promise.all(session.members.map(member => clearPresenceSession(member.accountId, sessionId.toString())));
    }
    return result.deletedCount == 1;

    /*const index = sessions.findIndex(session => session._id.equals(sessionId));
    if (index !== -1) {
        sessions.splice(index, 1);
    }*/
};

export const aggregateSessions = (): Promise<{ gameModeId: number; count: number }[]> => {
    return Session.aggregate([
        {
            $match: {
                freePublic: { $ne: 0 }
            }
        },
        {
            $group: {
                _id: "$gameModeId",
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                gameModeId: "$_id",
                count: 1
            }
        }
    ]);

    /*const result: { gameModeId: number; count: number }[] = [];
    for (const session of sessions) {
        if (session.freePublic != 0) {
            const obj = result.find(x => x.gameModeId == session.gameModeId);
            if (obj) {
                obj.count += 1;
            } else {
                result.push({ gameModeId: session.gameModeId, count: 1 });
            }
        }
    }
    return result;*/
};
