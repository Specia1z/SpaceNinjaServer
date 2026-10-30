import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Account } from "../../models/loginModel.ts";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { giveQuestKeyRewardController } from "./giveQuestKeyRewardController.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}quest-key-reward-controller-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("quest key rewards cannot directly grant PremiumCredits", async () => {
    const account = await new Account({
        email: "quest-reward-security@example.com",
        password: "password",
        DisplayName: "QuestRewardSecurity",
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/"
    }).save();
    const inventory = await new Inventory({ accountOwnerId: account._id, PremiumCredits: 10 }).save();
    let statusCode = 200;
    const response = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        send() {
            return this;
        },
        json() {
            return this;
        },
        end() {
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654" },
        body: JSON.stringify({ reward: { ItemType: "PremiumCredits", Amount: 1_000_000 } })
    } as unknown as Request;

    await (giveQuestKeyRewardController as RequestHandler)(request, response, () => {});

    assert.equal(statusCode, 400);
    assert.equal((await Inventory.findById(inventory._id))?.PremiumCredits, 10);
});
