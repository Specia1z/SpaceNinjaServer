import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { MetadataPatchSettings } from "../models/metadataPatchModel.ts";
import { config } from "./configService.ts";
import { getMetadataPatchState, initializeMetadataPatches, saveMetadataPatchState } from "./metadataPatchService.ts";

let mongod: MongoMemoryServer;
const previousTunables = config.tunables;

before(async () => {
    mongod = await MongoMemoryServer.create({
        binary: { version: "7.0.34", downloadDir: "node_modules/.cache" }
    });
    await mongoose.connect(`${mongod.getUri()}metadata-patch-test`);
});

after(async () => {
    config.tunables = previousTunables;
    await mongoose.disconnect();
    await mongod.stop();
});

void test("metadata patches import config once and then use MongoDB as source of truth", async () => {
    config.tunables = {
        rawMetadataPatches: "# initial raw",
        metadataPatches: [{ name: "initial", targets: ["/Initial"], operations: ["Set(1)"] }],
        accountMetadataPatches: { account: [{ name: "account", text: "/Account\nSet(2)" }] }
    };

    await initializeMetadataPatches();
    assert.deepEqual(getMetadataPatchState(), {
        rawPatches: "# initial raw",
        patches: [{ name: "initial", targets: ["/Initial"], operations: ["Set(1)"] }],
        accountPatches: { account: [{ name: "account", text: "/Account\nSet(2)" }] }
    });

    config.tunables.rawMetadataPatches = "# changed config";
    config.tunables.metadataPatches = [{ name: "changed", text: "/Changed" }];
    await initializeMetadataPatches();
    assert.equal(getMetadataPatchState().rawPatches, "# initial raw");
    assert.equal(getMetadataPatchState().patches[0].name, "initial");

    await saveMetadataPatchState({
        rawPatches: "# database raw",
        patches: [{ name: "global text", text: "/Global\nSet(3)" }],
        accountPatches: { account: [{ name: "account text", text: "/Account\nSet(4)" }] }
    });
    const persisted = await MetadataPatchSettings.findOne().lean();
    assert.ok(persisted);
    assert.equal(persisted.RawPatches, "# database raw");
    assert.equal(persisted.Patches[0].text, "/Global\nSet(3)");
    assert.equal(persisted.AccountPatches.account![0].text, "/Account\nSet(4)");
});
