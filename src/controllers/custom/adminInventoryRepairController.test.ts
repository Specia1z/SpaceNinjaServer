import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import type { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Account } from "../../models/loginModel.ts";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { config } from "../../services/configService.ts";
import {
    previewMisclassifiedAugmentRepairController,
    repairMisclassifiedAugmentController
} from "./adminInventoryRepairController.ts";

let mongod: MongoMemoryServer;
const previousAdministratorNames = config.administratorNames;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}admin-inventory-repair-controller-test`);
});

after(async () => {
    config.administratorNames = previousAdministratorNames;
    await mongoose.disconnect();
    await mongod.stop();
});

void test("inventory repair endpoints require an administrator and repair the reviewed account", async () => {
    const administrator = await new Account({
        email: "repair-admin@example.com",
        password: "password",
        DisplayName: "RepairAdmin",
        Nonce: 321
    }).save();
    const target = await new Account({
        email: "repair-target@example.com",
        password: "password",
        DisplayName: "RepairTarget",
        Nonce: 654
    }).save();
    config.administratorNames = [administrator.DisplayName];

    await new Inventory({
        accountOwnerId: target._id,
        Suits: [{ ItemType: "/Lotus/Powersuits/Frost/IceShieldAugmentTwoCard" }]
    }).save();

    const invoke = async (
        handler: RequestHandler,
        accountId: Types.ObjectId
    ): Promise<{ status: number; body: unknown }> => {
        let status = 200;
        let body: unknown;
        const res = {
            status(code: number) {
                status = code;
                return this;
            },
            send(value: unknown) {
                body = value;
                return this;
            },
            json(value: unknown) {
                body = value;
                return this;
            }
        } as unknown as Response;
        const req = {
            query: {
                accountId: accountId.toString(),
                nonce: String(accountId.equals(administrator._id) ? 321 : 654),
                targetAccountId: target._id.toString()
            },
            body: { accountId: target._id.toString(), expectedCount: 1 }
        } as unknown as Request;
        await handler(req, res, () => {});
        return { status, body };
    };

    const denied = await invoke(previewMisclassifiedAugmentRepairController, target._id);
    assert.equal(denied.status, 403);

    const preview = await invoke(previewMisclassifiedAugmentRepairController, administrator._id);
    assert.equal(preview.status, 200);
    assert.equal((preview.body as { affectedCount: number }).affectedCount, 1);

    const repaired = await invoke(repairMisclassifiedAugmentController, administrator._id);
    assert.equal(repaired.status, 200);
    assert.equal((repaired.body as { affectedCount: number }).affectedCount, 1);

    const stale = await invoke(repairMisclassifiedAugmentController, administrator._id);
    assert.equal(stale.status, 409);
});
