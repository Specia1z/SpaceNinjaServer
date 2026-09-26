import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { config } from "./configService.ts";
import {
    ACCOUNT_RATE_DEFINITIONS,
    getAccountRateProfile,
    getEffectiveAccountRate,
    parseAccountRateProfile
} from "./accountRateService.ts";

const previousProfiles = config.accountRateProfiles;
const previousDrops = config.accountDropMultipliers;
const account = { _id: { toString: (): string => "507f1f77bcf86cd799439011" }, DisplayName: "TestAccount" };

before(() => {
    config.accountRateProfiles = {};
    config.accountDropMultipliers = {};
});

after(() => {
    config.accountRateProfiles = previousProfiles;
    config.accountDropMultipliers = previousDrops;
});

void test("legacy drop rates remain active until replaced by an ID-bound profile", () => {
    config.accountDropMultipliers![account.DisplayName] = { resourceMultiplier: 5, modMultiplier: 3 };
    assert.equal(getAccountRateProfile(account).resourceDropMultiplier, 5);
    assert.equal(getAccountRateProfile(account).modDropMultiplier, 3);

    config.accountRateProfiles![account._id.toString()] = { resourceDropMultiplier: 2, modDropMultiplier: 4 };
    assert.equal(getAccountRateProfile(account).resourceDropMultiplier, 2);
    assert.equal(getAccountRateProfile(account).modDropMultiplier, 4);
    assert.equal(getAccountRateProfile(account).creditMultiplier, 1);
});

void test("disabled profiles leave rates at 1x without losing saved values", () => {
    config.accountRateProfiles![account._id.toString()] = { enabled: false, creditMultiplier: 10 };
    const profile = getAccountRateProfile(account);
    assert.equal(profile.creditMultiplier, 10);
    assert.equal(getEffectiveAccountRate(profile, "creditMultiplier"), 1);
});

void test("save validation accepts supported rates and rejects malformed values", () => {
    assert.deepEqual(parseAccountRateProfile({ enabled: true, creditMultiplier: 2.5 }), {
        enabled: true,
        creditMultiplier: 2.5
    });
    for (const bad of [NaN, Infinity, -1, 1001, "2"]) {
        assert.throws(() => parseAccountRateProfile({ creditMultiplier: bad }));
    }
    assert.throws(() => parseAccountRateProfile({ unknownMultiplier: 3 }));
    assert.throws(() => parseAccountRateProfile({ enabled: "true" }));
    assert.throws(() => parseAccountRateProfile({ relicRewardMultiplier: 0 }));
    assert.throws(() => parseAccountRateProfile({ dailyTributeMultiplier: 0 }));
    assert.equal(
        new Set(ACCOUNT_RATE_DEFINITIONS.map(definition => definition.key)).size,
        ACCOUNT_RATE_DEFINITIONS.length
    );
});
