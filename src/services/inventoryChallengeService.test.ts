import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { KAHL_EPOCH, unixTimesInMs } from "../constants/timeConstants.ts";
import { applyChallenges, applyKahlProgress, resetKahlWeeklyMission } from "./inventoryChallengeService.ts";

void test("challenge progress updates existing state without requiring reward acquisition", async () => {
    const inventory = {
        ChallengeProgress: [{ Name: "TestChallenge", Progress: 1, Completed: ["old"] }],
        Affiliations: [],
        accountOwnerId: "account"
    } as unknown as TInventoryDatabaseDocument;
    const changes = {};
    const affiliationMods = await applyChallenges(
        0,
        inventory,
        [{ Name: "TestChallenge", Progress: 4, Completed: ["old", "new"] }],
        undefined,
        changes,
        1,
        () => Promise.resolve({}),
        (target, delta) => Object.assign(target, delta)
    );
    assert.deepEqual(inventory.ChallengeProgress, [{ Name: "TestChallenge", Progress: 4, Completed: ["old", "new"] }]);
    assert.deepEqual(affiliationMods, []);
});

void test("Kahl challenge rewards only newly completed challenges", () => {
    const ordinaryChallenge = "/Lotus/Types/Challenges/KahlMissions/AnyKahlChallenge";
    const noDeathChallenge = "/Lotus/Types/Challenges/KahlMissions/NoDeathKahlChallenge";
    const inventory = {
        Affiliations: [{ Tag: "KahlSyndicate", WeeklyMissions: [{ WeekCount: 12, Challenges: [ordinaryChallenge] }] }],
        MiscItems: []
    } as unknown as TInventoryDatabaseDocument;
    const rewarded: number[] = [];
    const addStock = (_inventory: unknown, type: string, count: number): void => {
        assert.equal(type, "/Lotus/Types/Items/MiscItems/KahlCreds");
        rewarded.push(count);
    };
    const progress = [
        {
            Syndicate: "KahlSyndicate" as const,
            WeekCount: 12,
            CompletedChallenges: [ordinaryChallenge, noDeathChallenge],
            ResetChallenges: true
        }
    ];
    applyKahlProgress(inventory, progress, {}, addStock);
    applyKahlProgress(inventory, progress, {}, addStock);
    assert.deepEqual(rewarded, [30, 0]);
    assert.deepEqual(inventory.Affiliations[0].WeeklyMissions![0].Challenges, [ordinaryChallenge, noDeathChallenge]);
    assert.equal(inventory.Affiliations[0].WeeklyMissions![0].ChallengesReset, true);
});

void test("Kahl weekly reset retains completed mission and creates the next week once", () => {
    const currentWeek = Math.trunc((Date.now() - KAHL_EPOCH) / unixTimesInMs.week);
    const previousWeek = currentWeek - 1;
    const inventory = {
        Affiliations: [
            {
                Tag: "KahlSyndicate",
                WeeklyMissions: [
                    {
                        MissionIndex: 4,
                        CompletedMission: false,
                        JobManifest: "old",
                        Challenges: ["completed"],
                        WeekCount: previousWeek
                    }
                ]
            }
        ]
    } as unknown as TInventoryDatabaseDocument;
    resetKahlWeeklyMission(inventory, `KahlSyndicate_${previousWeek}`);
    resetKahlWeeklyMission(inventory, `KahlSyndicate_${previousWeek}`);
    const missions = inventory.Affiliations[0].WeeklyMissions!;
    assert.equal(missions.length, 2);
    assert.equal(missions[0].CompletedMission, true);
    assert.deepEqual(missions[0].Challenges, ["completed"]);
    assert.equal(missions[1].MissionIndex, 5);
    assert.equal(missions[1].CompletedMission, false);
    assert.equal(missions[1].WeekCount, currentWeek + 1);
    assert.deepEqual(missions[1].Challenges, []);
});
