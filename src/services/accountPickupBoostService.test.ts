import assert from "node:assert/strict";
import { test } from "node:test";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { toMongoDate2, toOid2 } from "../helpers/inventoryHelpers.ts";
import { buildVersionToInt } from "../helpers/versionHelper.ts";
import { applyAccountPickupBoost, applyAccountWorldStateBoost } from "./accountPickupBoostService.ts";
import { getAccountWorldStateToken } from "./loginService.ts";

const buildLabel = "2026.08.19.11.06";

void test("account pickup rate only changes the account-scoped world state", () => {
    const accountState = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    const otherState = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    applyAccountPickupBoost(accountState, buildLabel, 10);
    applyAccountPickupBoost(otherState, buildLabel, 1);
    assert.equal(accountState.GlobalUpgrades.length, 1);
    assert.equal(accountState.GlobalUpgrades[0].UpgradeType, "GAMEPLAY_PICKUP_AMOUNT");
    assert.equal(accountState.GlobalUpgrades[0].Value, 10);
    assert.equal(otherState.GlobalUpgrades.length, 0);
});

void test("account pickup bonus combines with an existing global boost", () => {
    const expiresAt = "2026-10-15T00:00:00.000Z";
    const initial = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    applyAccountPickupBoost(initial, buildLabel, 2);
    initial.GlobalUpgrades[0]._id = toOid2("5b23106f283a555109666674", buildVersionToInt(buildLabel));
    applyAccountPickupBoost(initial, buildLabel, 5, expiresAt);
    assert.equal(initial.GlobalUpgrades.length, 1);
    assert.equal(initial.GlobalUpgrades[0].Value, 10);
    assert.deepEqual(initial.GlobalUpgrades[0].ExpiryDate, toMongoDate2(Date.parse(expiresAt), buildLabel));
});

void test("account-specific cash and affinity events do not leak to another account", () => {
    const accountState = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    const otherState = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    const expiresAt = "2030-01-01T00:00:00.000Z";
    applyAccountWorldStateBoost(accountState, buildLabel, "credit", 3, expiresAt);
    applyAccountWorldStateBoost(accountState, buildLabel, "affinity", 4, expiresAt);
    applyAccountWorldStateBoost(otherState, buildLabel, "credit", 1);
    assert.deepEqual(
        accountState.GlobalUpgrades.map(upgrade => [upgrade.UpgradeType, upgrade.Value]),
        [
            ["GAMEPLAY_MONEY_REWARD_AMOUNT", 3],
            ["GAMEPLAY_KILL_XP_AMOUNT", 4]
        ]
    );
    assert.deepEqual(
        accountState.GlobalUpgrades.map(upgrade => upgrade.ExpiryDate),
        [0, 1].map(() => toMongoDate2(Date.parse(expiresAt), buildVersionToInt(buildLabel)))
    );
    assert.equal(otherState.GlobalUpgrades.length, 0);
});

void test("account cash and affinity rates compound with global events instead of duplicating them", () => {
    const buildVersion = buildVersionToInt(buildLabel);
    const expiresAt = "2026-10-15T00:00:00.000Z";
    const state = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    applyAccountWorldStateBoost(state, buildLabel, "credit", 2);
    applyAccountWorldStateBoost(state, buildLabel, "affinity", 2);
    state.GlobalUpgrades[0]._id = toOid2("5b23106f283a555109666672", buildVersion);
    state.GlobalUpgrades[1]._id = toOid2("5b23106f283a555109666673", buildVersion);
    applyAccountWorldStateBoost(state, buildLabel, "credit", 3, expiresAt);
    applyAccountWorldStateBoost(state, buildLabel, "affinity", 4, expiresAt);
    assert.deepEqual(
        state.GlobalUpgrades.map(upgrade => upgrade.Value),
        [6, 8]
    );
    assert.equal(state.GlobalUpgrades.length, 2);
    assert.deepEqual(
        state.GlobalUpgrades.map(upgrade => upgrade.ExpiryDate),
        [0, 1].map(() => toMongoDate2(Date.parse(expiresAt), buildVersion))
    );
});

void test("account expiry never extends an earlier global event or truncates an explicit account-only date", () => {
    const earlierGlobalExpiry = "2026-10-01T00:00:00.000Z";
    const accountExpiry = "2040-01-01T00:00:00.000Z";
    const state = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    applyAccountWorldStateBoost(state, buildLabel, "credit", 2, accountExpiry);
    assert.deepEqual(state.GlobalUpgrades[0].ExpiryDate, toMongoDate2(Date.parse(accountExpiry), buildLabel));
    state.GlobalUpgrades[0]._id = toOid2("5b23106f283a555109666672", buildLabel);
    state.GlobalUpgrades[0].ExpiryDate = toMongoDate2(Date.parse(earlierGlobalExpiry), buildLabel);
    applyAccountWorldStateBoost(state, buildLabel, "credit", 3, accountExpiry);
    assert.deepEqual(state.GlobalUpgrades[0].ExpiryDate, toMongoDate2(Date.parse(earlierGlobalExpiry), buildLabel));
});

void test("account world state tokens are bound to account and login nonce", () => {
    const token = getAccountWorldStateToken("6ab4e6b455fd6219d144d8a5", 5050670627356296);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.notEqual(token, getAccountWorldStateToken("6ab4e6b455fd6219d144d8a5", 5050670627356297));
    assert.notEqual(token, getAccountWorldStateToken("6ab2fa7d1b4b909c93d44912", 5050670627356296));
});
