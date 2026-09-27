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
    assert.equal(getAccountRateProfile(account).affinityMultiplier, 1);
});

void test("disabled profiles leave rates at 1x without losing saved values", () => {
    config.accountRateProfiles![account._id.toString()] = { enabled: false, creditMultiplier: 10 };
    const profile = getAccountRateProfile(account);
    assert.equal(profile.creditMultiplier, 10);
    assert.equal(getEffectiveAccountRate(profile, "creditMultiplier"), 1);
});

void test("expiring profiles apply only before their absolute expiration time", () => {
    const future = parseAccountRateProfile({
        enabled: true,
        expiresAt: "2099-01-01T00:00:00+08:00",
        creditMultiplier: 10,
        affinityMultiplier: 2
    });
    assert.equal(future.expiresAt, "2098-12-31T16:00:00.000Z");
    assert.equal(getEffectiveAccountRate({ ...getAccountRateProfile(account), ...future }, "creditMultiplier"), 10);
    assert.equal(getEffectiveAccountRate({ ...getAccountRateProfile(account), ...future }, "affinityMultiplier"), 2);

    const expired = parseAccountRateProfile({ enabled: true, expiresAt: "2000-01-01T00:00:00Z", creditMultiplier: 10 });
    assert.equal(getEffectiveAccountRate({ ...getAccountRateProfile(account), ...expired }, "creditMultiplier"), 1);
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
    for (const expiresAt of ["", "2099-01-01", "2099-01-01T00:00:00", "not-a-date", 123]) {
        assert.throws(() => parseAccountRateProfile({ expiresAt }));
    }
    assert.throws(() => parseAccountRateProfile({ relicRewardMultiplier: 0 }));
    assert.throws(() => parseAccountRateProfile({ dailyTributeMultiplier: 0 }));
    assert.equal(
        new Set(ACCOUNT_RATE_DEFINITIONS.map(definition => definition.key)).size,
        ACCOUNT_RATE_DEFINITIONS.length
    );
});
