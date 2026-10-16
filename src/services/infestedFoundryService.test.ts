import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { IInfestedFoundryClient } from "../types/inventoryTypes/inventoryTypes.ts";
import { config } from "./configService.ts";
import {
    applyCheatsToInfestedFoundry,
    hasInfiniteHelminthMaterials
} from "./infestedFoundryService.ts";

const accountId = "507f1f77bcf86cd799439011";
const otherAccountId = "507f1f77bcf86cd799439012";
const previousProfiles = config.accountFeatureProfiles;
const previousGlobalSetting = config.infiniteHelminthMaterials;

before(() => {
    config.accountFeatureProfiles = {};
    config.infiniteHelminthMaterials = false;
});

after(() => {
    config.accountFeatureProfiles = previousProfiles;
    config.infiniteHelminthMaterials = previousGlobalSetting;
});

void test("account-level infinite Helminth materials apply to the client snapshot", () => {
    config.accountFeatureProfiles![accountId] = { infiniteHelminthMaterials: true };
    assert.equal(hasInfiniteHelminthMaterials(accountId), true);

    const infestedFoundry = {} as IInfestedFoundryClient;
    applyCheatsToInfestedFoundry(infestedFoundry, accountId);

    assert.equal(infestedFoundry.Resources!.length, 6);
    assert.equal(infestedFoundry.Resources!.every(resource => resource.Count === 1000), true);
});

void test("disabled account-level infinite Helminth materials leave the snapshot unchanged", () => {
    const infestedFoundry = {} as IInfestedFoundryClient;
    applyCheatsToInfestedFoundry(infestedFoundry, otherAccountId);

    assert.equal(hasInfiniteHelminthMaterials(otherAccountId), false);
    assert.equal(infestedFoundry.Resources, undefined);
});
