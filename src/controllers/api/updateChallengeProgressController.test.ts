import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { Account } from "../../models/loginModel.ts";
import { updateChallengeProgressController } from "./updateChallengeProgressController.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}update-challenge-progress-controller-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("challenge progress updates persist legacy and Genesis Incarnon progress", async () => {
    const account = await new Account({
        email: "incarnon-challenge-progress@example.com",
        password: "password",
        DisplayName: "IncarnonChallenge",
        Nonce: 654,
        BuildLabel: "2013.01.04.10.41/"
    }).save();
    const inventory = await new Inventory({
        accountOwnerId: account._id,
        EvolutionProgress: [
            { ItemType: "/Lotus/Weapons/Tenno/LongGuns/LegacyIncarnon", Progress: 1, Rank: 1 },
            { ItemType: "/Lotus/Weapons/Tenno/LongGuns/GenesisIncarnon", Progress: 2, Rank: 1 }
        ]
    }).save();

    let responseBody: unknown;
    const response = {
        json(value: unknown) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654" },
        body: JSON.stringify({
            EvolutionProgress: [
                { ItemType: "/Lotus/Weapons/Tenno/LongGuns/LegacyIncarnon", Progress: 8, Rank: 1 },
                { ItemType: "/Lotus/Weapons/Tenno/LongGuns/GenesisIncarnon", Progress: 4, Rank: 2 }
            ]
        })
    } as unknown as Request;

    await (updateChallengeProgressController as RequestHandler)(request, response, () => {});

    assert.deepEqual(responseBody, { AffiliationMods: [], InventoryChanges: {} });
    const savedInventory = (await Inventory.findById(inventory._id))!;
    assert.deepEqual(
        savedInventory.EvolutionProgress?.map(({ ItemType, Progress, Rank }) => ({ ItemType, Progress, Rank })),
        [
            {
                ItemType: "/Lotus/Weapons/Tenno/LongGuns/LegacyIncarnon",
                Progress: 8,
                Rank: 1
            },
            {
                ItemType: "/Lotus/Weapons/Tenno/LongGuns/GenesisIncarnon",
                Progress: 4,
                Rank: 2
            }
        ]
    );
});
