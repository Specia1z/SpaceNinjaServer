import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { InvasionRewardClaim } from "../models/invasionRewardClaimModel.ts";
import { claimInvasionReward, completeInvasionRewardClaim } from "./invasionRewardClaimService.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({
        binary: { version: "7.0.34", downloadDir: "node_modules/.cache" }
    });
    await mongoose.connect(`${mongod.getUri()}invasion-reward-claim-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("only one request can claim an invasion reward and completed claims stay closed", async () => {
    const accountId = new Types.ObjectId();
    const first = await claimInvasionReward(accountId, "invasion-1");
    assert.equal(first.status, "claimed");

    const concurrent = await claimInvasionReward(accountId, "invasion-1");
    assert.equal(concurrent.status, "busy");

    await completeInvasionRewardClaim(first);

    const retry = await claimInvasionReward(accountId, "invasion-1");
    assert.equal(retry.status, "completed");
});

void test("a stale processing lease can be reclaimed", async () => {
    const accountId = new Types.ObjectId();
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const first = await claimInvasionReward(accountId, "invasion-2", claimedAt);
    assert.equal(first.status, "claimed");

    const reclaimed = await claimInvasionReward(accountId, "invasion-2", new Date("2026-01-01T00:05:01.000Z"));
    assert.equal(reclaimed.status, "claimed");
    assert.notEqual(reclaimed.claimToken, first.claimToken);

    await InvasionRewardClaim.deleteMany({ accountId });
});
