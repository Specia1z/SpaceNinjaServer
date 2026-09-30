import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { Account } from "../models/loginModel.ts";
import { config } from "./configService.ts";
import { generateReferralCode, reserveReferral, settleReferral } from "./playerReferralService.ts";

let mongod: MongoMemoryServer;
const previousPolicy = config.playerPortal;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}player-referral-test`);
    config.playerPortal = {
        enabled: true,
        registrationEnabled: true,
        renameEnabled: true,
        renameCost: 50,
        renameCooldownDays: 30,
        referralsEnabled: true,
        inviterReward: 25,
        inviteeReward: 30,
        maxReferralsPerAccount: 5,
        referralRequiredOnlineMinutes: 1,
        milestoneEvery: 1,
        milestoneBonus: 10
    };
});

after(async () => {
    config.playerPortal = previousPolicy;
    await mongoose.disconnect();
    await mongod.stop();
});

void test("referral rewards are reserved and settled idempotently", async () => {
    const inviter = await new Account({
        email: "inviter@example.com",
        password: "password",
        DisplayName: "Inviter",
        Nonce: 1,
        LastLogin: new Date()
    }).save();
    const invitee = await new Account({
        email: "invitee@example.com",
        password: "password",
        DisplayName: "Invitee",
        Nonce: 2,
        LastLogin: new Date()
    }).save();
    await new Inventory({ accountOwnerId: inviter._id, PremiumCredits: 0, PremiumCreditsFree: 0 }).save();
    await new Inventory({ accountOwnerId: invitee._id, PremiumCredits: 0, PremiumCreditsFree: 0 }).save();

    const code = await generateReferralCode(inviter._id);
    const reservation = await reserveReferral(code);
    assert.ok(reservation);
    invitee.ReferredBy = reservation.inviterId;
    invitee.ReferralInviterReward = reservation.inviterReward;
    invitee.ReferralInviteeReward = reservation.inviteeReward;
    invitee.ReferralMilestoneBonus = reservation.milestoneBonus;
    invitee.ReferralOnlineSeconds = 59;
    await invitee.save();

    await settleReferral(invitee);
    let inviterInventory = await Inventory.findOne({ accountOwnerId: inviter._id });
    let inviteeInventory = await Inventory.findOne({ accountOwnerId: invitee._id });
    assert.equal(inviterInventory?.PremiumCredits, 0);
    assert.equal(inviteeInventory?.PremiumCredits, 0);

    invitee.ReferralOnlineSeconds = 60;
    await invitee.save();
    await settleReferral(invitee);
    await settleReferral(invitee);
    inviterInventory = await Inventory.findOne({ accountOwnerId: inviter._id });
    inviteeInventory = await Inventory.findOne({ accountOwnerId: invitee._id });
    assert.equal(inviterInventory?.PremiumCredits, 35);
    assert.equal(inviteeInventory?.PremiumCredits, 30);
    assert.ok((await Account.findById(invitee._id))?.ReferralQualifiedAt);
});

void test("same registration sources are flagged without consuming an invite slot", async () => {
    const inviter = await new Account({
        email: "same-source-inviter@example.com",
        password: "password",
        DisplayName: "SameSourceInviter",
        RegistrationIpHash: "same-source",
        Nonce: 3,
        LastLogin: new Date()
    }).save();
    const code = await generateReferralCode(inviter._id);
    const reservation = await reserveReferral(code, { ipHash: "same-source" });

    assert.ok(reservation);
    assert.equal(reservation.risk, "same_registration_source");
    assert.equal(reservation.reservedCount, false);
    assert.equal((await Account.findById(inviter._id))?.ReferralCount, 0);
});
