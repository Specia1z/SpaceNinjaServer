import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { ExportRegions } from "warframe-public-export-plus";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { completeAllMissions, unlockStarChartForExistingAccounts } from "./accountInitializationService.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}global-star-chart-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("global star chart unlock updates existing inventories once and excludes system inventory", async () => {
    const first = await new Inventory({
        accountOwnerId: new Types.ObjectId(),
        Missions: [{ Tag: "SolNode1", Completes: 3, Tier: 0 }]
    }).save();
    const second = await new Inventory({ accountOwnerId: new Types.ObjectId() }).save();
    const system = await new Inventory({ MarketSystem: true, accountOwnerId: new Types.ObjectId() }).save();

    const [a, b] = await Promise.all([unlockStarChartForExistingAccounts(), unlockStarChartForExistingAccounts()]);
    assert.equal(a, 2);
    assert.equal(b, 2);

    const savedFirst = (await Inventory.findById(first._id))!;
    const savedSecond = (await Inventory.findById(second._id))!;
    assert.equal(savedFirst.Missions.find(x => x.Tag == "SolNode1")?.Completes, 3);
    assert.equal(savedFirst.Missions.length, Object.keys(ExportRegions).length);
    assert.equal(savedSecond.Missions.length, Object.keys(ExportRegions).length);
    assert.ok(savedFirst.Missions.every(x => x.Completes > 0 && x.Tier == 1));
    assert.ok(savedFirst.NodeIntrosCompleted.includes("TeshinHardModeUnlocked"));
    assert.ok(savedFirst.starChartUnlockVersion);
    assert.equal(savedFirst.starChartUnlockVersion, savedSecond.starChartUnlockVersion);
    assert.equal("starChartUnlockVersion" in savedFirst.toJSON(), false);
    assert.equal((await Inventory.findById(system._id))!.starChartUnlockVersion, undefined);

    const rewardsBefore = savedSecond.MiscItems.map(x => ({ ItemType: x.ItemType, ItemCount: x.ItemCount }));
    assert.equal(await unlockStarChartForExistingAccounts(), 0);
    assert.deepEqual(
        (await Inventory.findById(second._id))!.MiscItems.map(x => ({ ItemType: x.ItemType, ItemCount: x.ItemCount })),
        rewardsBefore
    );

    const normalOnly = await new Inventory({ accountOwnerId: new Types.ObjectId() }).save();
    await completeAllMissions(normalOnly, false);
    await normalOnly.save();
    assert.equal(normalOnly.starChartUnlockVersion, undefined);
    assert.equal(await unlockStarChartForExistingAccounts(), 1);
    assert.ok((await Inventory.findById(normalOnly._id))!.Missions.every(x => x.Tier == 1));
});
