import assert from "node:assert/strict";
import { test } from "node:test";
import type { IWorldState, ISyndicateMissionInfo, IVoidTrader } from "../types/worldStateTypes.ts";
import {
    getActiveVoidTrader,
    getInitialLiveGoalProgress,
    isFreshSupplementalWorldState,
    mergeCurrentSyndicateMissions,
    mergeLocalGoalProgress
} from "./liveWorldStateService.ts";
import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";

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
