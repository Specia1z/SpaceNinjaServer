import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { config } from "./configService.ts";
import {
    getAccountFeatureProfile,
    getEffectiveAccountFeatureProfile,
    parseAccountFeatureProfile
} from "./accountFeatureService.ts";

const previousProfiles = config.accountFeatureProfiles;
const previousGlobalValues = {
    universalPolarityEverywhere: config.universalPolarityEverywhere,
    unlockDoubleCapacityPotatoesEverywhere: config.unlockDoubleCapacityPotatoesEverywhere,
    unlockExilusEverywhere: config.unlockExilusEverywhere,
    unlockArcanesEverywhere: config.unlockArcanesEverywhere,
    infiniteHelminthMaterials: config.infiniteHelminthMaterials
};
const accountId = "507f1f77bcf86cd799439011";

before(() => {
    config.accountFeatureProfiles = {};
    config.universalPolarityEverywhere = false;
    config.unlockDoubleCapacityPotatoesEverywhere = false;
    config.unlockExilusEverywhere = false;
    config.unlockArcanesEverywhere = false;
    config.infiniteHelminthMaterials = false;
});

after(() => {
    config.accountFeatureProfiles = previousProfiles;
    Object.assign(config, previousGlobalValues);
});

void test("account feature profiles default to disabled and resolve by account id", () => {
    assert.deepEqual(getAccountFeatureProfile(accountId), {
        universalPolarityEverywhere: false,
        unlockDoubleCapacityPotatoesEverywhere: false,
        unlockExilusEverywhere: false,
        unlockArcanesEverywhere: false,
        infiniteHelminthMaterials: false
    });

    config.accountFeatureProfiles![accountId] = {
        unlockExilusEverywhere: true,
        infiniteHelminthMaterials: true
    };
    assert.equal(getEffectiveAccountFeatureProfile(accountId).unlockExilusEverywhere, true);
    assert.equal(getEffectiveAccountFeatureProfile(accountId).infiniteHelminthMaterials, true);
    assert.equal(getEffectiveAccountFeatureProfile("507f1f77bcf86cd799439012").unlockExilusEverywhere, false);
    assert.equal(getEffectiveAccountFeatureProfile("507f1f77bcf86cd799439012").infiniteHelminthMaterials, false);
});

void test("global feature settings remain effective for every account", () => {
    config.universalPolarityEverywhere = true;
    assert.equal(getEffectiveAccountFeatureProfile("any-account").universalPolarityEverywhere, true);
    config.infiniteHelminthMaterials = true;
    assert.equal(getEffectiveAccountFeatureProfile("any-account").infiniteHelminthMaterials, true);
});

void test("feature profile parsing accepts booleans and rejects unknown values", () => {
    assert.deepEqual(parseAccountFeatureProfile({ infiniteHelminthMaterials: true }), {
        infiniteHelminthMaterials: true
    });
    assert.throws(() => parseAccountFeatureProfile({ unlockArcanesEverywhere: "true" }));
    assert.throws(() => parseAccountFeatureProfile({ unknownFeature: true }));
});
