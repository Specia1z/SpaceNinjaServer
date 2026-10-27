import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { JSONStringify } from "json-with-bigint";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { Account } from "../../models/loginModel.ts";
import { MissionSettlementClaim } from "../../models/missionSettlementClaimModel.ts";
import type { IMissionInventoryUpdateResponse } from "../../types/missionTypes.ts";
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

void test("failed arbitration pays completed rotations but quitting and zero rotations do not", async () => {
    for (const [index, status, rotations] of [
        [1, "GS_FAILURE", 4],
        [2, "GS_QUIT", 4],
        [3, "GS_FAILURE", 0],
        [4, "GS_SUCCESS", 4]
    ] as const) {
        const account = await new Account({
            email: `arbitration-${index}@example.com`,
            password: "password",
            DisplayName: `Arbitration${index}`,
            Nonce: 654,
            BuildLabel: "2026.10.22.13.12/",
            DailyFirstWinDate: Math.trunc(Date.now() / 86400000) * 86400
        }).save();
        await new Inventory({ accountOwnerId: account._id, RegularCredits: 100 }).save();
        const report = {
            LevelKeyName: "",
            MissionFailed: status != "GS_SUCCESS",
            MissionStatus: status,
            AliveTime: 900,
            MissionTime: 900,
            GameModeId: 0,
            hosts: [],
            currentClients: [],
            ChallengeProgress: [],
            PS: "",
            ActiveDojoColorResearch: "",
            ReceivedCeremonyMsg: false,
            LastCeremonyResetDate: 0,
            MissionPTS: 42,
            RepHash: `arbitration-report-${index}`,
            EndOfMatchUpload: true,
            ObjectiveReached: rotations > 0,
            sharedSessionId: `0123456789abcdef0123456${index}`,
            FpsAvg: 0,
            FpsMin: 0,
            FpsMax: 0,
            FpsSamples: 0,
            PlayerSkillGains: {},
            RewardInfo: {
                node: "SolNode1",
                periodicMissionTag: "EliteAlert",
                rewardQualifications: "1".repeat(rotations),
                rewardSeed: 123
            }
        } as IMissionInventoryUpdateRequest;

        let responseBody: IMissionInventoryUpdateResponse | undefined;
        const response = {
            json(value: typeof responseBody) {
                responseBody = value;
                return this;
            }
        } as unknown as Response;
        const request = {
            query: { accountId: account._id.toString(), nonce: "654" },
            body: JSON.stringify(report),
            ip: "127.0.0.1"
        } as unknown as Request;

        const runSettlement = async (): Promise<void> => {
            const originalStringify = JSON.stringify;
            try {
                JSON.stringify = JSONStringify;
                await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
            } finally {
                JSON.stringify = originalStringify;
            }
        };
        await runSettlement();

        const rewards = responseBody!.MissionRewards!;
        assert.equal(rewards.length, status == "GS_QUIT" || rotations == 0 ? 0 : 5);
        if (rotations > 0 && status != "GS_QUIT") assert.equal(rewards[0].ItemCount, rotations);
        const rewardVitus = rewards
            .filter(item => item.StoreItem == "/Lotus/StoreItems/Types/Items/MiscItems/Elitium")
            .reduce((sum, item) => sum + item.ItemCount, 0);
        const inventory = (await Inventory.findOne({ accountOwnerId: account._id }))!;
        const vitusItemType = "/Lotus/Types/Items/MiscItems/Elitium";
        assert.equal(inventory.MiscItems.find(item => item.ItemType == vitusItemType)?.ItemCount ?? 0, rewardVitus);
        const visibleInventory = JSON.parse(responseBody!.InventoryJson!) as {
            MiscItems: { ItemType: string; ItemCount: number }[];
            RegularCredits: number;
        };
        assert.equal(
            visibleInventory.MiscItems.find(item => item.ItemType == vitusItemType)?.ItemCount ?? 0,
            rewardVitus
        );
        assert.equal(
            responseBody!.InventoryChanges?.MiscItems?.find(item => item.ItemType == vitusItemType)?.ItemCount ?? 0,
            rewardVitus
        );
        if (status == "GS_FAILURE" && rotations > 0) assert.ok(rewardVitus >= rotations);
        assert.equal(inventory.RegularCredits, status == "GS_SUCCESS" ? 50_100 : 100);
        assert.equal(visibleInventory.RegularCredits, inventory.RegularCredits);

        if (status == "GS_FAILURE" && rotations > 0) {
            await runSettlement();
            assert.deepEqual(responseBody!.MissionRewards, []);
            assert.equal(
                (await Inventory.findOne({ accountOwnerId: account._id }))!.MiscItems.find(
                    item => item.ItemType == vitusItemType
                )?.ItemCount,
                rewardVitus
            );
        }
    }
});
