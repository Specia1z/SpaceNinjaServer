import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { Account } from "../models/loginModel.ts";
import { playerPolicy, validatePlayerPolicy, validatePlayerPolicyField } from "./playerPortalService.ts";
import { changePlayerName } from "./playerPortalService.ts";
import { config } from "./configService.ts";

let mongod: MongoMemoryServer;
const previousPolicy = config.playerPortal;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}player-portal-test`);
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

void test("player portal policy has bounded, complete settings", () => {
    const policy = playerPolicy();

    assert.equal(validatePlayerPolicy(policy), true);
    assert.equal(validatePlayerPolicyField("playerPortal.renameCost", 100), undefined);
    assert.match(validatePlayerPolicyField("playerPortal.renameCost", -1) ?? "", /invalid/);
    assert.match(validatePlayerPolicyField("playerPortal.renameCost", 1.5) ?? "", /invalid/);
    assert.match(validatePlayerPolicyField("playerPortal.unknown", true) ?? "", /unknown/);
});

void test("player name changes charge Platinum once and enforce the cooldown", async () => {
    const account = await new Account({
        email: "rename@example.com",
        password: "password",
        DisplayName: "RenameMe",
        Nonce: 1,
        LastLogin: new Date()
    }).save();
    await new Inventory({ accountOwnerId: account._id, PremiumCredits: 100, PremiumCreditsFree: 100 }).save();

    assert.equal(await changePlayerName(account, "忍者一号", true), "ok");
    const inventory = await Inventory.findOne({ accountOwnerId: account._id });
    assert.equal(inventory!.PremiumCredits, 50);
    assert.equal(inventory!.PremiumCreditsFree, 50);
    const renamed = await Account.findById(account._id);
    assert.equal(renamed?.DisplayName, "忍者一号");
    assert.equal(await changePlayerName(renamed!, "另一个昵称", true), "cooldown");
});
