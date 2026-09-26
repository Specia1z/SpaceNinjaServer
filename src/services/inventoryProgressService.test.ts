import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IMission } from "../types/inventoryTypes/inventoryTypes.ts";
import { addBooster, addMissionComplete, setBooster } from "./inventoryProgressService.ts";

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
