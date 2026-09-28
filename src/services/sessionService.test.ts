import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import { Session } from "../models/sessionModel.ts";
import type { IMatchmakingSessionRequest, ISessionDatabase } from "../types/sessionTypes.ts";
import { buildMatchmakingQuery, rankSessionCandidates, reserveSessionSlot, updateSession } from "./sessionService.ts";

const request: IMatchmakingSessionRequest = {
    buildId: 202609241329n,
    gameModeId: 3026,
    regionId: 8,
    allowJIP: false,
    maxEloDifference: 10,
    eloRating: 5,
    enforceElo: true,
    platform: 0,
    xplatform: true
};

void test("public matchmaking query enforces compatibility and available slots", () => {
    assert.deepEqual(buildMatchmakingQuery(request), {
        buildId: 202609241329n,
        gameModeId: 3026,
        regionId: 8,
        freePublic: { $gte: 1 },
        hasStarted: false,
        eloRating: { $gte: -5, $lte: 15 },
        $or: [{ xplatform: true }, { platform: 0 }]
    });
});

void test("matchmaking ranks ELO first, then populated and fresh sessions", () => {
    const now = Date.now();
    const makeCandidate = (
        id: string,
        eloRating: number,
        freePublic: number,
        ageMs: number
    ): {
        _id: Types.ObjectId;
        eloRating: number;
        maxPlayers: number;
        freePublic: number;
        freePrivate: number;
        lastUpdate: Date;
    } => ({
        _id: new Types.ObjectId(id),
        eloRating,
        maxPlayers: 4,
        freePublic,
        freePrivate: 0,
        lastUpdate: new Date(now - ageMs)
    });
    const lessPopulated = makeCandidate("000000000000000000000001", 5, 2, 1_000);
    const populated = makeCandidate("000000000000000000000002", 5, 1, 2_000);
    const fartherElo = makeCandidate("000000000000000000000003", 3, 1, 100);

    assert.deepEqual(rankSessionCandidates([fartherElo, lessPopulated, populated], request), [
        populated,
        lessPopulated,
        fartherElo
    ]);
});

void test("slot reservation is idempotent for an existing member", async t => {
    const accountId = new Types.ObjectId();
    const existingSession = { _id: new Types.ObjectId() } as ISessionDatabase;
    const findOne = t.mock.method(Session, "findOne", () => Promise.resolve(existingSession));
    const findOneAndUpdate = t.mock.method(Session, "findOneAndUpdate", () =>
        Promise.resolve(null as ISessionDatabase | null)
    );

    assert.equal(await reserveSessionSlot([existingSession._id.toString()], accountId), existingSession);
    assert.equal(findOne.mock.calls.length, 1);
    assert.equal(findOneAndUpdate.mock.calls.length, 0);
});

void test("slot reservation atomically prefers public then falls back to private", async t => {
    const accountId = new Types.ObjectId();
    const sessionId = new Types.ObjectId().toString();
    const privateSession = { _id: new Types.ObjectId(sessionId) } as ISessionDatabase;
    t.mock.method(Session, "findOne", () => Promise.resolve(null));
    let updateCount = 0;
    const findOneAndUpdate = t.mock.method(Session, "findOneAndUpdate", () => {
        updateCount += 1;
        return Promise.resolve(updateCount == 2 ? privateSession : null);
    });

    assert.equal(await reserveSessionSlot([sessionId], accountId), privateSession);
    assert.equal(findOneAndUpdate.mock.calls.length, 2);

    const publicCall = findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(publicCall[0], {
        _id: sessionId,
        freePublic: { $gte: 1 },
        "members.accountId": { $ne: accountId }
    });
    assert.deepEqual((publicCall[1] as { $inc: object }).$inc, { freePublic: -1 });

    const privateCall = findOneAndUpdate.mock.calls[1].arguments;
    assert.deepEqual(privateCall[0], {
        _id: sessionId,
        freePrivate: { $gte: 1 },
        "members.accountId": { $ne: accountId }
    });
    assert.deepEqual((privateCall[1] as { $inc: object }).$inc, { freePrivate: -1 });
});

void test("host member update returns the exact occupied slot once", async t => {
    const creatorId = new Types.ObjectId();
    const memberAccountId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const releaseLookup = {
        members: [{ accountId: memberAccountId, slotType: "public" }]
    } as ISessionDatabase;
    const writableSession = {
        lastUpdate: new Date(0),
        save: () => Promise.resolve()
    } as unknown as ISessionDatabase & { save: () => Promise<void> };
    let lookupCount = 0;
    t.mock.method(Session, "findOne", () => {
        lookupCount += 1;
        return Promise.resolve(lookupCount == 1 ? releaseLookup : writableSession);
    });
    const findOneAndUpdate = t.mock.method(Session, "findOneAndUpdate", () => Promise.resolve(releaseLookup));

    assert.equal(
        await updateSession(
            sessionId,
            JSON.stringify({ memberAccountId: memberAccountId.toString(), freePublicInc: 1, platform: 0 }),
            creatorId
        ),
        true
    );
    assert.equal(findOneAndUpdate.mock.calls.length, 1);
    const releaseCall = findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual((releaseCall[1] as { $inc: object }).$inc, { freePublic: 1 });
    assert.deepEqual((releaseCall[1] as { $pull: object }).$pull, { members: { accountId: memberAccountId } });
    assert.equal((writableSession as unknown as { platform: number }).platform, 0);
});
