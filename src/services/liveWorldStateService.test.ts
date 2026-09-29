import assert from "node:assert/strict";
import { test } from "node:test";
import type { IWorldState } from "../types/worldStateTypes.ts";
import {
    fetchCurrentLiveWorldState,
    getLocalizedLiveEvents,
    mergeLiveWorldStateProgress,
    parseLiveWorldState
} from "./liveWorldStateService.ts";

const emptyLiveWorldState = {
    Events: [],
    Goals: [],
    Alerts: [],
    Sorties: [],
    LiteSorties: [],
    ActiveMissions: [],
    VoidTraders: [],
    VoidStorms: [],
    DailyDeals: [],
    Conquests: []
};

void test("live world state preserves unknown future top-level fields", () => {
    const parsed = parseLiveWorldState({
        ...emptyLiveWorldState,
        BuildLabel: "future-build",
        FutureRotation: { Version: 1, Entries: ["new-content"] }
    });

    assert.deepEqual(parsed.FutureRotation, { Version: 1, Entries: ["new-content"] });
});

void test("progress overlays keep unknown official goals and invasions", () => {
    const knownGoal = {
        _id: { $oid: "000000000000000000000001" },
        Count: 1
    } as unknown as IWorldState["Goals"][number];
    const futureGoal = {
        _id: { $oid: "000000000000000000000002" },
        FutureProgress: true
    } as unknown as IWorldState["Goals"][number];
    const knownInvasion = {
        _id: { $oid: "000000000000000000000003" },
        Count: 1
    } as unknown as IWorldState["Invasions"][number];
    const futureInvasion = {
        _id: { $oid: "000000000000000000000004" },
        FutureFaction: "FC_FUTURE"
    } as unknown as IWorldState["Invasions"][number];
    const parsed = parseLiveWorldState({
        ...emptyLiveWorldState,
        Goals: [knownGoal, futureGoal],
        Invasions: [knownInvasion, futureInvasion],
        FutureRotation: { Enabled: true }
    });
    const merged = mergeLiveWorldStateProgress(
        parsed,
        new Map([["000000000000000000000001", { ...knownGoal, Count: 9 }]]),
        new Map([["000000000000000000000003", { ...knownInvasion, Count: 7 }]])
    );

    assert.equal(merged.Goals[0].Count, 9);
    assert.equal((merged.Goals[1] as unknown as { FutureProgress: boolean }).FutureProgress, true);
    const mergedInvasions = merged.Invasions;
    assert.ok(mergedInvasions);
    assert.equal(mergedInvasions[0].Count, 7);
    assert.equal((mergedInvasions[1] as unknown as { FutureFaction: string }).FutureFaction, "FC_FUTURE");
    assert.deepEqual(merged.FutureRotation, { Enabled: true });
});

void test("live events are localized without leaking LanguageCode", () => {
    const events = getLocalizedLiveEvents(
        [
            {
                Prop: "TestEvent",
                Msg: "Fallback",
                Messages: [
                    { LanguageCode: "en", Message: "English" },
                    { LanguageCode: "zh", Message: "Chinese" }
                ]
            }
        ],
        "zh"
    );

    assert.deepEqual(events[0].Messages, [{ Message: "Chinese" }]);
});

void test("the complete browse.wf world state is preferred", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    try {
        globalThis.fetch = (input): Promise<Response> => {
            const url = String(input);
            calls.push(url);
            return Promise.resolve(
                new Response(JSON.stringify({ ...emptyLiveWorldState, FutureRotation: { Enabled: true } }), {
                    status: 200
                })
            );
        };

        const result = await fetchCurrentLiveWorldState();
        assert.deepEqual(calls, ["https://oracle.browse.wf/worldState.json"]);
        assert.equal(result.source.name, "browse.wf");
        assert.deepEqual(result.worldState.FutureRotation, { Enabled: true });

        calls.length = 0;
        await fetchCurrentLiveWorldState();
        assert.deepEqual(calls, ["https://oracle.browse.wf/worldState.json"]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
