import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "./configService.ts";
import { applyGlobalAccountCheats, defaultAccountCheats, validateAccountCheatConfig } from "./accountCheatService.ts";

void test("global account cheat config overrides legacy inventory values", () => {
    const previous = config.accountCheats;
    config.accountCheats = {
        infiniteCredits: true,
        spoofMasteryRank: 42
    };
    const values = new Map<string, unknown>();
    const unmarked: string[] = [];

    applyGlobalAccountCheats({
        set: (key, value) => values.set(key, value),
        unmarkModified: key => unmarked.push(key)
    });

    assert.equal(values.get("infiniteCredits"), true);
    assert.equal(values.get("spoofMasteryRank"), 42);
    assert.equal(values.get("skipAllDialogue"), false);
    assert.equal(defaultAccountCheats.nemesisTaxRateReductionPercent, 0);
    assert.equal(values.get("nemesisTaxRateReductionPercent"), defaultAccountCheats.nemesisTaxRateReductionPercent);
    assert.equal(values.get("nemesisExtraWeapon"), defaultAccountCheats.nemesisExtraWeapon);
    assert.equal(unmarked.length, values.size);
    config.accountCheats = previous;
});

void test("global account cheat config validates keys and numeric bounds", () => {
    assert.equal(validateAccountCheatConfig("accountCheats.infiniteCredits", true), undefined);
    assert.match(validateAccountCheatConfig("accountCheats.infiniteCredits", 1) ?? "", /boolean/);
    assert.equal(validateAccountCheatConfig("accountCheats.spoofMasteryRank", -1), undefined);
    assert.match(validateAccountCheatConfig("accountCheats.spoofMasteryRank", 65536) ?? "", /integer/);
    assert.equal(validateAccountCheatConfig("accountCheats.nemesisTaxRateReductionPercent", 100), undefined);
    assert.match(validateAccountCheatConfig("accountCheats.nemesisTaxRateReductionPercent", 101) ?? "", /integer/);
    assert.match(validateAccountCheatConfig("accountCheats.notARealCheat", true) ?? "", /Unknown/);
});
