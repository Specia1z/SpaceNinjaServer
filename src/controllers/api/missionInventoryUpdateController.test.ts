import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { Account } from "../../models/loginModel.ts";
import { MissionSettlementClaim } from "../../models/missionSettlementClaimModel.ts";
import type { IMissionInventoryUpdateRequest } from "../../types/requestTypes.ts";
import { getMissionSettlementKey } from "../../services/missionSettlementClaimService.ts";
import { missionInventoryUpdateController } from "./missionInventoryUpdateController.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}mission-inventory-update-controller-test`);
    await MissionSettlementClaim.init();
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("a completed settlement replay does not apply client inventory deltas", async () => {
    const account = await new Account({
        email: "settlement-replay@example.com",
        password: "password",
        DisplayName: "SettlementReplay",
        Nonce: 654,
        BuildLabel: "2013.01.04.10.41/"
    }).save();
    const inventory = await new Inventory({ accountOwnerId: account._id, RegularCredits: 100 }).save();
    const report = {
        LevelKeyName: "",
        MissionFailed: true,
        MissionStatus: "GS_FAILURE",
        AliveTime: 0,
        MissionTime: 0,
        GameModeId: 0,
        hosts: [],
        currentClients: [],
        ChallengeProgress: [],
        PS: "",
        ActiveDojoColorResearch: "",
        ReceivedCeremonyMsg: false,
        LastCeremonyResetDate: 0,
        MissionPTS: 42,
        RepHash: "rep-hash-1",
        EndOfMatchUpload: true,
        ObjectiveReached: false,
        sharedSessionId: "0123456789abcdef01234567",
        FpsAvg: 0,
        FpsMin: 0,
        FpsMax: 0,
        FpsSamples: 0,
        PlayerSkillGains: {},
        RegularCredits: 25
    } as IMissionInventoryUpdateRequest;
    const settlementKey = getMissionSettlementKey(report);
    assert.ok(settlementKey);
    await MissionSettlementClaim.create({
        accountId: account._id,
        settlementKey,
        status: "completed",
        claimToken: "previous-claim",
        claimedAt: new Date(),
        completedAt: new Date()
    });

    let responseBody: unknown;
    const response = {
        json(value: unknown) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654" },
        body: JSON.stringify(report),
        ip: "127.0.0.1"
    } as unknown as Request;

    await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});

    assert.deepEqual(responseBody, {});
    assert.equal((await Inventory.findById(inventory._id))?.RegularCredits, 100);
});
