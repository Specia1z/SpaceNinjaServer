import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { Account } from "../models/loginModel.ts";
import { config } from "../services/configService.ts";
import { findAccountByEmail } from "../services/loginService.ts";
import { verifyAccountPassword } from "../services/passwordService.ts";
import { hashAccountPassword } from "../services/passwordService.ts";
import { whirlpoolHash } from "../services/whirlpoolService.ts";
import { playerLoginController } from "./playerPortalController.ts";

let mongod: MongoMemoryServer;
const previousPolicy = config.playerPortal;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}player-portal-controller-test`);
    config.playerPortal = {
        enabled: true,
        registrationEnabled: true,
        renameEnabled: true,
        renameCost: 50,
        renameCooldownDays: 30,
        referralsEnabled: true,
        inviterReward: 25,
        inviteeReward: 25,
        maxReferralsPerAccount: 25,
        milestoneEvery: 5,
        milestoneBonus: 50
    };
});

after(async () => {
    config.playerPortal = previousPolicy;
    await mongoose.disconnect();
    await mongod.stop();
});

void test("player login accepts a legacy plaintext administrator password", async () => {
    const account = await new Account({
        email: "Portal-Admin@Example.com",
        password: "legacy-password",
        DisplayName: "PortalAdmin",
        Nonce: 1,
        LastLogin: new Date()
    }).save();
    await new Inventory({ accountOwnerId: account._id, PremiumCredits: 100, PremiumCreditsFree: 100 }).save();

    const output: { status?: number; body?: Record<string, unknown>; cookie?: string } = {};
    const request = {
        body: { email: "portal-admin@example.com", password: "legacy-password" },
        headers: {},
        secure: false,
        socket: {}
    } as never;
    const response = {
        setHeader(name: string, value: string) {
            if (name == "Set-Cookie") output.cookie = value;
        },
        json(body: Record<string, unknown>) {
            output.body = body;
        },
        status(status: number) {
            output.status = status;
            return {
                json: (body: Record<string, unknown>): void => {
                    output.body = body;
                }
            };
        }
    } as never;

    await playerLoginController(request, response, () => undefined);

    assert.equal(output.status, undefined);
    assert.equal(output.body?.displayName, "PortalAdmin");
    assert.ok(output.cookie);
    const upgraded = await Account.findById(account._id);
    assert.match(upgraded!.password, /^scrypt:v1:/);
    assert.equal(await verifyAccountPassword(whirlpoolHash("legacy-password"), upgraded!.password), true);
});

void test("legacy email lookup does not select an ambiguous case-insensitive match", async () => {
    const first = await new Account({
        email: "Duplicate@Example.com",
        password: "first-password",
        DisplayName: "FirstDuplicate"
    }).save();
    await new Account({
        email: "DUPLICATE@example.com",
        password: "second-password",
        DisplayName: "SecondDuplicate"
    }).save();

    assert.equal((await findAccountByEmail("Duplicate@Example.com"))?._id.toString(), first._id.toString());
    assert.equal(await findAccountByEmail("duplicate@example.com"), null);
});

void test("player login upgrades raw-password accounts without breaking WebUI login", async () => {
    const account = await new Account({
        email: "raw-player@example.com",
        password: await hashAccountPassword("player-password"),
        PlayerPasswordVersion: 1,
        DisplayName: "RawPlayer",
        Nonce: 1,
        LastLogin: new Date()
    }).save();
    await new Inventory({ accountOwnerId: account._id, PremiumCredits: 100, PremiumCreditsFree: 100 }).save();

    const output: { body?: Record<string, unknown> } = {};
    const request = {
        body: { email: "raw-player@example.com", password: "player-password" },
        headers: {},
        secure: false,
        socket: {}
    } as never;
    const response = {
        setHeader() {},
        json(body: Record<string, unknown>) {
            output.body = body;
        },
        status() {
            return { json() {} };
        }
    } as never;

    await playerLoginController(request, response, () => undefined);

    assert.equal(output.body?.displayName, "RawPlayer");
    const upgraded = await Account.findById(account._id);
    assert.equal(await verifyAccountPassword(whirlpoolHash("player-password"), upgraded!.password), true);
});
