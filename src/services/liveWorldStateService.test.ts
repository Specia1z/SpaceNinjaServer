import assert from "node:assert/strict";
import { test } from "node:test";
import type { IWorldState, ISyndicateMissionInfo, IVoidTrader } from "../types/worldStateTypes.ts";
import {
    getActiveVoidTrader,
    getCompatibleSeasonInfo,
    getInitialLiveGoalProgress,
    isLiveInvasionCompleted,
    isFreshSupplementalWorldState,
    mergeLocalInvasionProgress,
    mergeCurrentSyndicateMissions,
    mergeLocalGoalProgress
} from "./liveWorldStateService.ts";
import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";
import { getSeasonChallengePools, pushWeeklyActs } from "./worldStateService.ts";

const now = 1_790_876_000_000;
const mission = (tag: string, start: number, end: number): ISyndicateMissionInfo => ({
    _id: { $oid: `${tag}-${start}` },
    Tag: tag,
    Activation: { $date: { $numberLong: String(start) } },
    Expiry: { $date: { $numberLong: String(end) } },
    Seed: 1,
    Nodes: [],
    Jobs: []
});

void test("stale supplemental snapshots cannot win the mirror race", () => {
    assert.equal(isFreshSupplementalWorldState(now / 1000 - 14 * 3600, now), false);
    assert.equal(isFreshSupplementalWorldState(now / 1000 - 15, now), true);
    assert.equal(isFreshSupplementalWorldState(undefined, now), false);
});

void test("expired live bounties fall back to generated missions while current ones remain live", () => {
    const cetus = mission("CetusSyndicate", now - 1000, now + 1000);
    const fortuna = mission("SolarisSyndicate", now - 1000, now + 1000);
    const expired = mission("CetusSyndicate", now - 10_000, now - 1000);
    const liveFortuna = mission("SolarisSyndicate", now - 2000, now + 2000);
    assert.deepEqual(mergeCurrentSyndicateMissions([cetus, fortuna], [expired, liveFortuna], now), [
        cetus,
        liveFortuna
    ]);
    assert.deepEqual(mergeCurrentSyndicateMissions([cetus], [expired], now), [cetus]);
});

void test("a future live rotation does not hide the current generated bounty", () => {
    const generated = mission("CetusSyndicate", now - 1000, now + 1000);
    const upcoming = mission("CetusSyndicate", now + 1000, now + 5000);
    assert.deepEqual(mergeCurrentSyndicateMissions([generated, upcoming], [upcoming], now), [generated, upcoming]);
});

void test("historical weekly acts use the requested rotation week", () => {
    const pools = getSeasonChallengePools("RadioLegionIntermission16Syndicate");
    const currentWeek: NonNullable<IWorldState["SeasonInfo"]>["ActiveChallenges"] = [];
    const previousWeek: NonNullable<IWorldState["SeasonInfo"]>["ActiveChallenges"] = [];
    pushWeeklyActs(currentWeek, pools, 100, 1786548600000, 18);
    pushWeeklyActs(previousWeek, pools, 99, 1786548600000, 18);

    assert.notDeepEqual(
        currentWeek.map(challenge => challenge._id.$oid),
        previousWeek.map(challenge => challenge._id.$oid)
    );
    assert.notEqual(currentWeek[0].Activation.$date.$numberLong, previousWeek[0].Activation.$date.$numberLong);
});

void test("official Nightwave metadata is filtered for the client build", () => {
    const knownChallenge = [...getSeasonChallengePools("RadioLegionIntermission16Syndicate").daily][0];
    const seasonInfo = {
        Activation: { $date: { $numberLong: "1786548600000" } },
        Expiry: { $date: { $numberLong: "2000000000000" } },
        AffiliationTag: "RadioLegionIntermission16Syndicate",
        Season: 18,
        Phase: 0,
        Params: "",
        ActiveChallenges: [
            { _id: { $oid: "known" }, Challenge: knownChallenge },
            { _id: { $oid: "unknown" }, Challenge: "/Lotus/Unknown/Challenge" }
        ]
    } as NonNullable<IWorldState["SeasonInfo"]>;

    const compatible = getCompatibleSeasonInfo(seasonInfo, gameToBuildVersionInt["43.5.0"]);
    assert.deepEqual(
        compatible?.ActiveChallenges.map(challenge => challenge._id.$oid),
        ["known"]
    );
});

void test("active void trader is selected from the effective world-state window", () => {
    const trader = (node: string, activation: number, expiry: number): IVoidTrader => ({
        _id: { $oid: `${node}-${activation}` },
        Activation: { $date: { $numberLong: String(activation) } },
        Expiry: { $date: { $numberLong: String(expiry) } },
        Character: "Baro'Ki Teel",
        Node: node,
        Manifest: []
    });
    const traders = [
        trader("PlutoHUB", now - 10_000, now - 1_000),
        trader("SaturnHUB", now - 1_000, now + 1_000),
        trader("EarthHUB", now + 1_000, now + 10_000)
    ];
    assert.equal(getActiveVoidTrader(traders, now)?.Node, "SaturnHUB");
});

void test("local goal progress wins and retained goals survive an upstream omission", () => {
    const goal = (oid: string, count: number, tag = "HeatFissure"): IWorldState["Goals"][number] =>
        ({
            _id: { $oid: oid },
            Activation: { $date: { $numberLong: "1790000000000" } },
            Expiry: { $date: { $numberLong: "1791000000000" } },
            Count: count,
            Goal: 100,
            Personal: true,
            Community: true,
            Tag: tag,
            Desc: "",
            Success: 0
        }) as unknown as IWorldState["Goals"][number];

    const generated = [goal("local", 0, "LocalEvent")];
    const live = [goal("active", 90)];
    const persisted = [goal("active", 7), goal("retained", 42)];
    const merged = mergeLocalGoalProgress(generated, live, persisted, gameToBuildVersionInt["43.5.0"]);

    assert.deepEqual(
        merged.map(value => value._id.$oid),
        ["local", "active", "retained"]
    );
    assert.equal(merged.find(value => value._id.$oid == "active")?.Count, 7);
    assert.equal(merged.find(value => value._id.$oid == "retained")?.Count, 42);
});

void test("official goal metadata wins while persisted progress is retained", () => {
    const official = {
        _id: { $oid: "shared-goal" },
        Activation: { $date: { $numberLong: "1790000000000" } },
        Expiry: { $date: { $numberLong: "1791000000000" } },
        Count: 90,
        Goal: 100,
        Tag: "OfficialGoal",
        Desc: "official description",
        Personal: false
    } as unknown as IWorldState["Goals"][number];
    const persisted = {
        ...official,
        Desc: "stale local description",
        Count: 7
    } as unknown as IWorldState["Goals"][number];

    const merged = mergeLocalGoalProgress([], [official], [persisted], gameToBuildVersionInt["43.5.0"]);
    assert.equal(merged[0].Desc, "official description");
    assert.equal(merged[0].Count, 7);
});

void test("invasion progress adopts a more advanced official count without regressing local progress", () => {
    assert.equal(mergeLocalInvasionProgress(0, 1200), 1200);
    assert.equal(mergeLocalInvasionProgress(1500, 1200), 1500);
    assert.equal(mergeLocalInvasionProgress(-1500, -2000), -2000);
    assert.equal(mergeLocalInvasionProgress(1500, undefined), 1500);
    assert.equal(isLiveInvasionCompleted(1000, 30000, false), false);
    assert.equal(isLiveInvasionCompleted(1000, 30000, true), true);
    assert.equal(isLiveInvasionCompleted(30000, 30000, false), true);
});

void test("official Naberus replaces the generated October goal with its own expiry and ID", () => {
    const generated = {
        _id: { $oid: "66fd602de1778d583419e8e7" },
        Activation: { $date: { $numberLong: "1790812800000" } },
        Expiry: { $date: { $numberLong: "1793491200000" } },
        Tag: "DeimosHalloween",
        Desc: "/Lotus/Language/Events/HalloweenNaberusName",
        Node: "DeimosHub",
        Personal: true,
        Goal: 0,
        Count: 0,
        Success: 0
    } as IWorldState["Goals"][number];
    const official = {
        ...generated,
        _id: { $oid: "6abe75700000000000000000" },
        Activation: { $date: { $numberLong: "1790866800000" } },
        Expiry: { $date: { $numberLong: "1793635200000" } }
    };
    const otherNode = { ...generated, _id: { $oid: "different-node" }, Node: "OtherNode" };
    const otherRotation = {
        ...generated,
        _id: { $oid: "later-rotation" },
        Activation: { $date: { $numberLong: "1793700000000" } },
        Expiry: { $date: { $numberLong: "1793800000000" } }
    };
    const version = gameToBuildVersionInt["43.5.0"];

    assert.deepEqual(mergeLocalGoalProgress([generated], [official], [], version), [official]);
    assert.deepEqual(mergeLocalGoalProgress([generated], [], [official], version), [official]);
    assert.deepEqual(mergeLocalGoalProgress([generated], [], [], version), [generated]);
    assert.deepEqual(mergeLocalGoalProgress([otherNode, otherRotation], [official], [], version), [
        otherNode,
        otherRotation,
        official
    ]);
});

void test("new official goals are included and seed local progress once", () => {
    const additiveGoal = {
        _id: { $oid: "new-additive" },
        Activation: { $date: { $numberLong: "1790000000000" } },
        Expiry: { $date: { $numberLong: "1791000000000" } },
        Count: 42,
        Goal: 100,
        Personal: false,
        Community: true,
        Tag: "NewOfficialEvent",
        Desc: ""
    } as unknown as IWorldState["Goals"][number];
    const merged = mergeLocalGoalProgress([], [additiveGoal], [], gameToBuildVersionInt["43.5.0"]);
    const additiveInitial = getInitialLiveGoalProgress(additiveGoal, "additive", 100);

    assert.equal(merged[0]._id.$oid, "new-additive");
    assert.equal(additiveInitial.count, 42);
    assert.equal(additiveInitial.healthPct, 0.42);
    assert.equal(additiveInitial.initialProgressSource, "official");

    const depletionGoal = {
        ...additiveGoal,
        _id: { $oid: "new-depletion" },
        Count: undefined,
        HealthPct: 0.25,
        Fomorian: true
    } as unknown as IWorldState["Goals"][number];
    const depletionInitial = getInitialLiveGoalProgress(depletionGoal, "depletion", 100);

    assert.equal(depletionInitial.count, 75);
    assert.equal(depletionInitial.healthPct, 0.25);
    assert.equal(depletionInitial.initialProgressSource, "official");
});
