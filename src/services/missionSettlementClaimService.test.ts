import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { MissionSettlementClaim } from "../models/missionSettlementClaimModel.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import {
    claimMissionSettlement,
    completeMissionSettlementClaim,
    getMissionSettlementKey
} from "./missionSettlementClaimService.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({
        binary: { version: "7.0.34", downloadDir: "node_modules/.cache" }
    });
    await mongoose.connect(`${mongod.getUri()}mission-settlement-claim-test`);
    await MissionSettlementClaim.init();
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

const makeReport = (overrides: Partial<IMissionInventoryUpdateRequest> = {}): IMissionInventoryUpdateRequest =>
    ({
        sharedSessionId: "0123456789abcdef01234567",
        MissionPTS: 42,
        RepHash: "rep-hash-1",
        RewardInfo: {
            node: "SolNode1",
            rewardSeed: 123n,
            jobId: "job-1",
            JobStage: 2,
            CheckpointCounter: 4
        },
        ...overrides
    }) as IMissionInventoryUpdateRequest;

void test("settlement identity ignores inventory deltas but separates mission runs and stages", () => {
    const first = makeReport();
    const replayWithChangedDrops = makeReport({
        MiscItems: [{ ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate", ItemCount: 999 }]
    });
    assert.equal(getMissionSettlementKey(first), getMissionSettlementKey(replayWithChangedDrops));

    assert.notEqual(getMissionSettlementKey(first), getMissionSettlementKey(makeReport({ MissionPTS: 43 })));
    assert.notEqual(getMissionSettlementKey(first), getMissionSettlementKey(makeReport({ RepHash: "rep-hash-2" })));
    assert.notEqual(
        getMissionSettlementKey(first),
        getMissionSettlementKey(makeReport({ RewardInfo: { ...first.RewardInfo!, JobStage: 3 } }))
    );
    assert.equal(
        getMissionSettlementKey(first),
        getMissionSettlementKey(makeReport({ sharedSessionId: "0123456789ABCDEF01234567" }))
    );
    assert.equal(getMissionSettlementKey(makeReport({ sharedSessionId: "session-1" })), undefined);
    assert.equal(getMissionSettlementKey(makeReport({ MissionPTS: Number.NaN })), undefined);
    assert.equal(getMissionSettlementKey(makeReport({ RepHash: "" })), undefined);
});

void test("only one request can claim a settlement and completed claims stay closed", async () => {
    const accountId = new Types.ObjectId();
    const settlementKey = getMissionSettlementKey(makeReport())!;
    const [first, concurrent] = await Promise.all([
        claimMissionSettlement(accountId, settlementKey),
        claimMissionSettlement(accountId, settlementKey)
    ]);
    const claimed = first.status == "claimed" ? first : concurrent.status == "claimed" ? concurrent : undefined;
    assert.ok(claimed);
    assert.ok([first.status, concurrent.status].includes("busy"));

    await completeMissionSettlementClaim(claimed);

    const retry = await claimMissionSettlement(accountId, settlementKey);
    assert.equal(retry.status, "completed");
});

void test("a stale processing claim can be reclaimed", async () => {
    const accountId = new Types.ObjectId();
    const settlementKey = getMissionSettlementKey(makeReport({ MissionPTS: 99 }))!;
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const first = await claimMissionSettlement(accountId, settlementKey, claimedAt);
    assert.equal(first.status, "claimed");

    const reclaimed = await claimMissionSettlement(accountId, settlementKey, new Date("2026-01-01T00:05:01.000Z"));
    assert.equal(reclaimed.status, "claimed");
    assert.notEqual(reclaimed.claimToken, first.claimToken);
});
