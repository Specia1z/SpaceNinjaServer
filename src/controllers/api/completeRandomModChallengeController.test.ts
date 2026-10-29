import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { Account } from "../../models/loginModel.ts";
import { completeRandomModChallengeController } from "./completeRandomModChallengeController.ts";
import { creditsController } from "./creditsController.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}complete-random-mod-challenge-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("consecutive Riven challenge completions charge 20 platinum each time", async () => {
    const account = await new Account({
        email: "riven-platinum@example.com",
        password: "password",
        DisplayName: "RivenPlatinum",
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/"
    }).save();
    const inventory = await new Inventory({
        accountOwnerId: account._id,
        PremiumCredits: 100,
        PremiumCreditsFree: 10,
        Upgrades: Array.from({ length: 3 }, () => ({
            ItemType: "/Lotus/Upgrades/Mods/Randomized/PlayerMeleeWeaponRandomModRare",
            UpgradeFingerprint: JSON.stringify({ challenge: { Type: "Test", Progress: 0, Required: 3 } })
        }))
    }).save();
    const itemIds = inventory.Upgrades.map(upgrade => upgrade._id.toString());
    let responseBody:
        | { InventoryChanges: { PremiumCredits?: number; PremiumCreditsFree?: number }; Fingerprint: string }
        | undefined;
    const response = {
        json(value: typeof responseBody) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    let creditsBody: { PremiumCredits: number; PremiumCreditsFree: number } | undefined;
    const creditsResponse = {
        json(value: typeof creditsBody) {
            creditsBody = value;
            return this;
        }
    } as unknown as Response;

    for (const [index, itemId] of itemIds.entries()) {
        const request = {
            query: { accountId: account._id.toString(), nonce: "654", p: "1" },
            body: JSON.stringify({ ItemId: itemId })
        } as unknown as Request;

        await (completeRandomModChallengeController as RequestHandler)(request, response, () => {});

        const savedInventory = (await Inventory.findById(inventory._id))!;
        assert.equal(savedInventory.PremiumCredits, 100 - (index + 1) * 20);
        assert.equal(savedInventory.PremiumCreditsFree, 0);
        assert.deepEqual(responseBody!.InventoryChanges, {
            PremiumCredits: -20,
            ...(index == 0 ? { PremiumCreditsFree: -10 } : {})
        });
        const fingerprint = JSON.parse(savedInventory.Upgrades.id(itemId)!.UpgradeFingerprint!) as {
            challenge: { Progress: number };
        };
        assert.equal(fingerprint.challenge.Progress, 3);

        await (creditsController as RequestHandler)(request, creditsResponse, () => {});
        assert.equal(creditsBody!.PremiumCredits, 100 - (index + 1) * 20);
        assert.equal(creditsBody!.PremiumCreditsFree, 0);
    }
});
