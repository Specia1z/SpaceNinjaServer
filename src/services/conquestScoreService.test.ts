import assert from "node:assert/strict";
import { test } from "node:test";
import { getConquestMissionScore } from "./conquestScoreService.ts";

void test("counts fulfilled equipment suggestions from the client bitfield", () => {
    const shared = {
        ConquestEquipmentSuggestionsFulfilledBitfield: 0b1111,
        ConquestPersonalModifiersActive: 4
    };

    assert.equal(getConquestMissionScore({ ...shared, ConquestCompleted: 0 }), 9);
    assert.equal(getConquestMissionScore({ ...shared, ConquestCompleted: 1 }), 18);
    assert.equal(getConquestMissionScore({ ...shared, ConquestCompleted: 2 }), 27);
});

void test("prefers the legacy scalar equipment count when both fields exist", () => {
    assert.equal(
        getConquestMissionScore({
            ConquestCompleted: 0,
            ConquestEquipmentSuggestionsFulfilled: 2,
            ConquestEquipmentSuggestionsFulfilledBitfield: 0b1111
        }),
        3
    );
});

void test("adds hard mode score and the final mission bonus", () => {
    assert.equal(
        getConquestMissionScore({
            ConquestCompleted: 2,
            ConquestEquipmentSuggestionsFulfilledBitfield: 0b1111,
            ConquestHardModeActive: 1,
            ConquestPersonalModifiersActive: 4
        }),
        37
    );
});
