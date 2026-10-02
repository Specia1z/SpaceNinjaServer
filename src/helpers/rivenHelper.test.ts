import assert from "node:assert/strict";
import { test } from "node:test";
import type { IUpgrade } from "warframe-public-export-plus";
import {
    getLockedTraitValidationError,
    getLockedTraitRequestValidationError,
    getRivenRerollCost,
    type IUnveiledRivenFingerprint,
    randomiseRivenStats
} from "./rivenHelper.ts";

const rivenMeta = {
    upgradeEntries: [
        { tag: "BuffLocked", canBeBuff: true, canBeCurse: false },
        { tag: "BuffOne", canBeBuff: true, canBeCurse: false },
        { tag: "BuffTwo", canBeBuff: true, canBeCurse: false },
        { tag: "BuffThree", canBeBuff: true, canBeCurse: false },
        { tag: "BuffFour", canBeBuff: true, canBeCurse: false },
        { tag: "CurseLocked", canBeBuff: false, canBeCurse: true },
        { tag: "CurseOne", canBeBuff: false, canBeCurse: true },
        { tag: "CurseTwo", canBeBuff: false, canBeCurse: true }
    ]
} as unknown as IUpgrade;

const createFingerprint = (): IUnveiledRivenFingerprint => ({
    compat: "TestWeapon",
    lim: 0,
    lvl: 0,
    lvlReq: 8,
    rerolls: 4,
    pol: "AP_ATTACK",
    buffs: [
        { Tag: "BuffLocked", Value: 123456 },
        { Tag: "BuffOne", Value: 111 },
        { Tag: "BuffTwo", Value: 222 }
    ],
    curses: [{ Tag: "CurseLocked", Value: 654321 }]
});

void test("locked positive Riven trait keeps its value and stat shape", () => {
    const fingerprint = createFingerprint();

    randomiseRivenStats(rivenMeta, fingerprint, ["BuffLocked"]);

    assert.deepEqual(
        fingerprint.buffs.find(stat => stat.Tag == "BuffLocked"),
        { Tag: "BuffLocked", Value: 123456 }
    );
    assert.equal(fingerprint.buffs.length, 3);
    assert.equal(fingerprint.curses.length, 1);
    assert.equal(new Set([...fingerprint.buffs, ...fingerprint.curses].map(stat => stat.Tag)).size, 4);
});

void test("locked negative Riven trait keeps its value and stat shape", () => {
    const fingerprint = createFingerprint();

    randomiseRivenStats(rivenMeta, fingerprint, ["CurseLocked"]);

    assert.deepEqual(fingerprint.curses, [{ Tag: "CurseLocked", Value: 654321 }]);
    assert.equal(fingerprint.buffs.length, 3);
    assert.equal(fingerprint.curses.length, 1);
    assert.equal(new Set([...fingerprint.buffs, ...fingerprint.curses].map(stat => stat.Tag)).size, 4);
});

void test("locked Riven cycles double the normal Kuva cost", () => {
    assert.equal(getRivenRerollCost(0), 900);
    assert.equal(getRivenRerollCost(0, true), 1800);
    assert.equal(getRivenRerollCost(8), 3150);
    assert.equal(getRivenRerollCost(8, true), 6300);
    assert.equal(getRivenRerollCost(9), 3500);
    assert.equal(getRivenRerollCost(99, true), 7000);
});

void test("U44 accepts only one trait that exists on the Riven", () => {
    const fingerprint = createFingerprint();

    assert.equal(getLockedTraitRequestValidationError(undefined), undefined);
    assert.equal(getLockedTraitRequestValidationError(["BuffLocked"]), undefined);
    assert.equal(
        getLockedTraitRequestValidationError(["BuffLocked", "CurseLocked"]),
        "Only one Riven trait can be locked"
    );
    assert.equal(getLockedTraitRequestValidationError([42]), "LockedTraits must be an array of trait tags");
    assert.equal(getLockedTraitValidationError(fingerprint, ["BuffLocked"]), undefined);
    assert.equal(getLockedTraitValidationError(fingerprint, undefined), undefined);
    assert.equal(
        getLockedTraitValidationError(fingerprint, ["MissingTrait"]),
        "Locked Riven trait does not exist on this mod"
    );
    assert.equal(
        getLockedTraitValidationError(fingerprint, ["BuffLocked", "CurseLocked"]),
        "Only one Riven trait can be locked"
    );
    assert.equal(getLockedTraitValidationError(fingerprint, [42]), "LockedTraits must be an array of trait tags");
});
