import assert from "node:assert/strict";
import { test } from "node:test";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { toOid2 } from "../helpers/inventoryHelpers.ts";
import { buildVersionToInt } from "../helpers/versionHelper.ts";
import { applyAccountPickupBoost } from "./accountPickupBoostService.ts";
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
    const initial = { GlobalUpgrades: [] } as Pick<IWorldState, "GlobalUpgrades">;
    applyAccountPickupBoost(initial, buildLabel, 2);
    initial.GlobalUpgrades[0]._id = toOid2("5b23106f283a555109666674", buildVersionToInt(buildLabel));
    applyAccountPickupBoost(initial, buildLabel, 5);
    assert.equal(initial.GlobalUpgrades.length, 1);
    assert.equal(initial.GlobalUpgrades[0].Value, 10);
});

void test("account world state tokens are bound to account and login nonce", () => {
    const token = getAccountWorldStateToken("6ab4e6b455fd6219d144d8a5", 5050670627356296);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.notEqual(token, getAccountWorldStateToken("6ab4e6b455fd6219d144d8a5", 5050670627356297));
    assert.notEqual(token, getAccountWorldStateToken("6ab2fa7d1b4b909c93d44912", 5050670627356296));
});
