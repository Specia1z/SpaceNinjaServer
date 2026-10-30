import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Account } from "../../models/loginModel.ts";
import { Inbox } from "../../models/inboxModel.ts";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import type { TAccountDocument } from "../../services/loginService.ts";
import { inboxController } from "./inboxController.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}inbox-controller-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

const createAccount = async (name: string, email: string): Promise<TAccountDocument> => {
    return await new Account({
        email,
        password: "password",
        DisplayName: name,
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/"
    }).save();
};

const readMessage = async (accountId: string, messageId: string): Promise<void> => {
    const request = {
        query: { accountId, nonce: "654", messageId },
        ip: "127.0.0.1"
    } as unknown as Request;
    const response = {
        json(value: unknown) {
            return value;
        },
        end() {
            return this;
        },
        status() {
            return this;
        }
    } as unknown as Response;

    await (inboxController as RequestHandler)(request, response, () => {});
};

void test("inbox currency is owner-scoped and can only be claimed once", async () => {
    const owner = await createAccount("InboxOwner", "inbox-owner@example.com");
    const other = await createAccount("InboxOther", "inbox-other@example.com");
    const ownerInventory = await new Inventory({ accountOwnerId: owner._id, PremiumCredits: 10 }).save();
    const otherInventory = await new Inventory({ accountOwnerId: other._id, PremiumCredits: 20 }).save();
    const message = await new Inbox({
        ownerId: owner._id,
        sndr: "Ordis",
        msg: "reward",
        sub: "reward",
        date: new Date(),
        PremiumCredits: 25
    }).save();

    await readMessage(owner._id.toString(), message._id.toString());
    assert.equal((await Inventory.findById(ownerInventory._id))?.PremiumCredits, 35);

    await readMessage(owner._id.toString(), message._id.toString());
    assert.equal((await Inventory.findById(ownerInventory._id))?.PremiumCredits, 35);

    const secondMessage = await new Inbox({
        ownerId: owner._id,
        sndr: "Ordis",
        msg: "second reward",
        sub: "second reward",
        date: new Date(),
        PremiumCredits: 7
    }).save();
    await readMessage(other._id.toString(), secondMessage._id.toString());
    assert.equal((await Inventory.findById(otherInventory._id))?.PremiumCredits, 20);
    assert.equal((await Inbox.findById(secondMessage._id))?.r, undefined);

    await readMessage(owner._id.toString(), secondMessage._id.toString());
    assert.equal((await Inventory.findById(ownerInventory._id))?.PremiumCredits, 42);
    assert.equal((await Inbox.findById(message._id))?.PremiumCredits, undefined);
});
