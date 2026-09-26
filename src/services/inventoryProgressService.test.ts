import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IMission } from "../types/inventoryTypes/inventoryTypes.ts";
import {
    addBooster,
    addFocusXpIncreases,
    addLoreFragmentScans,
    addMissionComplete,
    setBooster
} from "./inventoryProgressService.ts";

void test("mission completion ignores empty tags and updates steel path tier", () => {
    const inventory = {
        Missions: [{ Tag: "SolNode1", Completes: 1, Tier: 1 }]
    } as unknown as TInventoryDatabaseDocument;
    addMissionComplete(inventory, { Tag: "SolNode1", Completes: 1, Tier: 2 } as IMission);
    addMissionComplete(inventory, { Tag: "", Completes: 1 } as IMission);
    assert.deepEqual(inventory.Missions, [{ Tag: "SolNode1", Completes: 2, Tier: 2 }]);
});

void test("boosters extend existing time and set an absolute minimum expiry", () => {
    const inventory = {
        Boosters: [{ ItemType: "CreditBooster", ExpiryDate: 0 }]
    } as unknown as TInventoryDatabaseDocument;
    addBooster("CreditBooster", 60, inventory);
    assert.ok(inventory.Boosters[0].ExpiryDate >= 60);
    setBooster("CreditBooster", 30, inventory);
    assert.ok(inventory.Boosters[0].ExpiryDate >= 60);
    setBooster("ResourceBooster", 100, inventory);
    assert.equal(inventory.Boosters.length, 2);
});

void test("focus and lore progress merge into existing inventory entries", () => {
    const inventory = {
        FocusXP: { AP_ATTACK: 10 },
        DailyFocus: 100,
        noDailyFocusLimit: false,
        LoreFragmentScans: [{ ItemType: "fragment", Progress: 1 }]
    } as unknown as TInventoryDatabaseDocument;
    addFocusXpIncreases(inventory, [0, 5, 0, 0, 0, 0, 0, 0]);
    assert.equal(inventory.FocusXP!.AP_ATTACK, 15);
    assert.equal(inventory.DailyFocus, 95);
    addLoreFragmentScans(inventory, [
        { ItemType: "fragment", Region: "", Progress: 2 },
        { ItemType: "new-fragment", Region: "", Progress: 1 }
    ]);
    assert.deepEqual(inventory.LoreFragmentScans, [
        { ItemType: "fragment", Progress: 3 },
        { ItemType: "new-fragment", Region: "", Progress: 1 }
    ]);
});
