import assert from "node:assert/strict";
import { test } from "node:test";
import type { ISyndicateMissionInfo } from "../types/worldStateTypes.ts";
import { isFreshSupplementalWorldState, mergeCurrentSyndicateMissions } from "./liveWorldStateService.ts";

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
