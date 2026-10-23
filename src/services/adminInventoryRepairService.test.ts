import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import {
    InventoryRepairConflictError,
    MISCLASSIFIED_AUGMENT_ITEM,
    previewMisclassifiedAugmentRepair,
    repairMisclassifiedAugmentInventory
} from "./adminInventoryRepairService.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}admin-inventory-repair-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("inventory repair preview is read-only and repair moves only the affected cards", async () => {
    const accountOwnerId = new Types.ObjectId();
    const inventory = await new Inventory({
        accountOwnerId,
        Suits: [
            { ItemType: MISCLASSIFIED_AUGMENT_ITEM },
            { ItemType: MISCLASSIFIED_AUGMENT_ITEM },
            { ItemType: "/Lotus/Powersuits/Frost/Frost" }
        ],
        RawUpgrades: [
            { ItemType: MISCLASSIFIED_AUGMENT_ITEM, ItemCount: 4 },
            { ItemType: "/Lotus/Upgrades/Mods/OtherMod", ItemCount: 1 }
        ],
        SuitBin: { Slots: 10 }
    }).save();

    assert.deepEqual(await previewMisclassifiedAugmentRepair(accountOwnerId.toString()), {
        inventoryFound: true,
        itemType: MISCLASSIFIED_AUGMENT_ITEM,
        affectedCount: 2,
        suitSlotsToReturn: 2
    });
    assert.equal(inventory.Suits.length, 3);
    assert.equal(inventory.SuitBin.Slots, 10);

    assert.deepEqual(await repairMisclassifiedAugmentInventory(accountOwnerId.toString(), 2), {
        inventoryFound: true,
        itemType: MISCLASSIFIED_AUGMENT_ITEM,
        affectedCount: 2,
        suitSlotsToReturn: 2
    });

    const repaired = (await Inventory.findOne({ accountOwnerId }))!;
    assert.deepEqual(
        repaired.Suits.map(item => item.ItemType),
        ["/Lotus/Powersuits/Frost/Frost"]
    );
    assert.equal(repaired.RawUpgrades.find(item => item.ItemType == MISCLASSIFIED_AUGMENT_ITEM)?.ItemCount, 6);
    assert.equal(repaired.RawUpgrades.find(item => item.ItemType == "/Lotus/Upgrades/Mods/OtherMod")?.ItemCount, 1);
    assert.equal(repaired.SuitBin.Slots, 12);
    await assert.rejects(
        repairMisclassifiedAugmentInventory(accountOwnerId.toString(), 2),
        InventoryRepairConflictError
    );
    assert.equal((await Inventory.findOne({ accountOwnerId }))!.SuitBin.Slots, 12);
});

void test("inventory repair rejects a stale preview without changing inventory", async () => {
    const accountOwnerId = new Types.ObjectId();
    await new Inventory({
        accountOwnerId,
        Suits: [{ ItemType: MISCLASSIFIED_AUGMENT_ITEM }],
        SuitBin: { Slots: 5 }
    }).save();

    await assert.rejects(
        repairMisclassifiedAugmentInventory(accountOwnerId.toString(), 2),
        InventoryRepairConflictError
    );
    const inventory = (await Inventory.findOne({ accountOwnerId }))!;
    assert.equal(inventory.Suits.length, 1);
    assert.equal(inventory.RawUpgrades.length, 0);
    assert.equal(inventory.SuitBin.Slots, 5);
});

void test("concurrent repairs apply only once", async () => {
    const accountOwnerId = new Types.ObjectId();
    await new Inventory({
        accountOwnerId,
        Suits: [{ ItemType: MISCLASSIFIED_AUGMENT_ITEM }],
        SuitBin: { Slots: 5 }
    }).save();

    const results = await Promise.allSettled([
        repairMisclassifiedAugmentInventory(accountOwnerId.toString(), 1),
        repairMisclassifiedAugmentInventory(accountOwnerId.toString(), 1)
    ]);
    assert.equal(results.filter(result => result.status == "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status == "rejected").length, 1);

    const inventory = (await Inventory.findOne({ accountOwnerId }))!;
    assert.equal(inventory.Suits.length, 0);
    assert.equal(inventory.RawUpgrades.find(item => item.ItemType == MISCLASSIFIED_AUGMENT_ITEM)?.ItemCount, 1);
    assert.equal(inventory.SuitBin.Slots, 6);
});
