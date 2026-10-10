import assert from "node:assert/strict";
import { test } from "node:test";
import type { INemesisDatabase } from "../types/inventoryTypes/inventoryTypes.ts";
import { advanceNemesisHintProgress, getNemesisPasscode, getNemesisTaxInfo } from "./nemesisHelpers.ts";

const makeNemesis = (faction: INemesisDatabase["Faction"], nodeCount: number): INemesisDatabase =>
    ({
        fp: 1n,
        Faction: faction,
        InfNodes: Array.from({ length: nodeCount }, (_, index) => ({ Node: `node${index}`, Influence: 1 })),
        HintProgress: 0,
        Hints: []
    }) as unknown as INemesisDatabase;

void test("nemesis tax reduction applies to Grineer and Corpus rates", () => {
    const grineerNemesis = makeNemesis("FC_GRINEER", 10);
    const corpusNemesis = makeNemesis("FC_CORPUS", 10);
    const grineer = getNemesisTaxInfo(grineerNemesis, 50);
    const corpus = getNemesisTaxInfo(corpusNemesis, 50);

    assert.equal(getNemesisTaxInfo(grineerNemesis)?.TaxRate, 0.07);
    assert.equal(getNemesisTaxInfo(corpusNemesis)?.TaxRate, 0.95);
    assert.equal(grineer?.TaxRate, 0.035);
    assert.equal(corpus?.TaxRate, 0.475);
});

void test("nemesis tax reduction supports exemption and leaves Infested unaffected", () => {
    assert.equal(getNemesisTaxInfo(makeNemesis("FC_GRINEER", 10), 100)?.TaxRate, 0);
    assert.equal(getNemesisTaxInfo(makeNemesis("FC_INFESTATION", 10), 100), undefined);
});

void test("nemesis hint progress unlocks every crossed threshold", () => {
    const nemesis = makeNemesis("FC_GRINEER", 1);
    const passcode = getNemesisPasscode(nemesis);

    assert.equal(advanceNemesisHintProgress(nemesis, 35, 1), 1);
    assert.equal(nemesis.Hints.length, 1);
    assert.equal(nemesis.HintProgress, 0);

    assert.equal(advanceNemesisHintProgress(nemesis, 60, 1), 1);
    assert.equal(nemesis.Hints.length, 2);
    assert.equal(nemesis.HintProgress, 0);

    assert.equal(advanceNemesisHintProgress(nemesis, 100, 1), 1);
    assert.equal(nemesis.Hints.length, 3);
    assert.equal(nemesis.HintProgress, 0);
    assert.deepEqual([...nemesis.Hints].sort(), [...passcode].sort());
});

void test("nemesis hint progress handles multiple thresholds and zero multiplier", () => {
    const nemesis = makeNemesis("FC_CORPUS", 1);

    assert.equal(advanceNemesisHintProgress(nemesis, 200, 1), 3);
    assert.equal(nemesis.Hints.length, 3);
    assert.equal(nemesis.HintProgress, 0);

    const untouched = makeNemesis("FC_GRINEER", 1);
    assert.equal(advanceNemesisHintProgress(untouched, 200, 0), 0);
    assert.equal(untouched.Hints.length, 0);
    assert.equal(untouched.HintProgress, 0);
});

void test("infested nemesis does not use requiem hint progress", () => {
    const nemesis = makeNemesis("FC_INFESTATION", 1);

    assert.equal(advanceNemesisHintProgress(nemesis, 200, 10), 0);
    assert.equal(nemesis.Hints.length, 0);
    assert.equal(nemesis.HintProgress, 0);
});
