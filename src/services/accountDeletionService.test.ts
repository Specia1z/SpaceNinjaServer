import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { CurrencyGrantStat } from "../models/currencyGrantStatModel.ts";
import { Friendship } from "../models/friendModel.ts";
import { GuildMember } from "../models/guildModel.ts";
import { Ignore, Account } from "../models/loginModel.ts";
import { Inbox } from "../models/inboxModel.ts";
import { InvasionRewardClaim } from "../models/invasionRewardClaimModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { Loadout } from "../models/inventoryModels/loadoutModel.ts";
import { Leaderboard } from "../models/leaderboardModel.ts";
import { PendingTrade } from "../models/tradingModel.ts";
import { PersonalRooms } from "../models/personalRoomsModel.ts";
import { PlayerMarketCounter, PlayerMarketLedger } from "../models/playerMarketModel.ts";
import { PlayerPresence, PlayerPresenceEvent } from "../models/presenceModel.ts";
import { PlayerSession } from "../models/playerSessionModel.ts";
import { Session } from "../models/sessionModel.ts";
import { Ship } from "../models/shipModel.ts";
import { SuspicionEvent } from "../models/suspicionEventModel.ts";
import { Stats } from "../models/statsModel.ts";
import { config } from "./configService.ts";
import { deleteAccountData } from "./accountDeletionService.ts";

let mongod: MongoMemoryServer;
const previousAdministratorNames = config.administratorNames;
const previousDropMultipliers = config.accountDropMultipliers;
const previousRateProfiles = config.accountRateProfiles;
const previousFeatureProfiles = config.accountFeatureProfiles;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}account-deletion-test`);
});

after(async () => {
    config.administratorNames = previousAdministratorNames;
    config.accountDropMultipliers = previousDropMultipliers;
    config.accountRateProfiles = previousRateProfiles;
    config.accountFeatureProfiles = previousFeatureProfiles;
    await mongoose.disconnect();
    await mongod.stop();
});

void test("deletes account-owned data and unlinks related account state", async () => {
    const target = await new Account({
        email: "delete-target@example.com",
        password: "password",
        DisplayName: "DeleteTarget",
        ReferralCount: 0
    }).save();
    const inviter = await new Account({
        email: "delete-inviter@example.com",
        password: "password",
        DisplayName: "DeleteInviter",
        ReferralCount: 1
    }).save();
    const referred = await new Account({
        email: "delete-referred@example.com",
        password: "password",
        DisplayName: "DeleteReferred",
        ReferredBy: target._id,
        ReferralInviterReward: 10,
        ReferralInviteeReward: 10
    }).save();
    target.ReferredBy = inviter._id;
    await target.save();

    const otherId = new Types.ObjectId();
    const guildId = new Types.ObjectId();
    await Friendship.create({ owner: target._id, friend: otherId });
    await Ignore.create({ ignorer: otherId, ignoree: target._id });
    await Inbox.create({ ownerId: target._id, sndr: "Test", sub: "Test", msg: "Test", date: new Date() });
    await Inventory.create({ accountOwnerId: target._id });
    await Loadout.create({ loadoutOwnerId: target._id });
    await PersonalRooms.create({ personalRoomsOwnerId: target._id });
    await Ship.create({ ShipOwnerId: target._id });
    await Stats.create({ accountOwnerId: target._id });
    await GuildMember.create({ accountId: target._id, guildId, status: 1 });
    await Leaderboard.create({ leaderboard: "test", ownerId: target._id, displayName: target.DisplayName, score: 1 });
    await PendingTrade.create({ a: target._id, b: otherId, clanTax: 0 });
    await CurrencyGrantStat.create({ Day: "2099-01-01", AccountOwnerId: target._id, Source: "test" });
    await InvasionRewardClaim.create({
        accountId: target._id,
        invasionId: "test-invasion",
        status: "completed",
        claimToken: "claim-token",
        claimedAt: new Date()
    });
    await PlayerMarketCounter.create({
        scope: target._id.toString(),
        periodKey: "2099-01-01",
        tradedPlatinum: 1,
        transactions: 1,
        quantity: 1,
        updatedAt: new Date()
    });
    await PlayerMarketLedger.create({
        accountId: target._id,
        requestId: "delete-request",
        side: "sell",
        inventoryField: "MiscItems",
        itemType: "/Lotus/Types/Items/MiscItems/Ferrite",
        mode: "stack",
        quantity: 1,
        unitPrice: 1,
        totalPrice: 1,
        status: "completed",
        createdAt: new Date()
    });
    await PlayerPresence.create({
        AccountId: target._id,
        DisplayName: target.DisplayName,
        Online: false,
        State: "offline",
        LastSeenAt: new Date(),
        UpdatedAt: new Date()
    });
    await PlayerPresenceEvent.create({
        AccountId: target._id,
        DisplayName: target.DisplayName,
        Type: "logout",
        State: "offline",
        Online: false,
        CreatedAt: new Date()
    });
    await PlayerSession.create({
        accountId: target._id,
        tokenHash: "delete-token",
        passwordVersion: 0,
        expiresAt: new Date(Date.now() + 60_000)
    });
    await SuspicionEvent.create({
        AccountId: target._id,
        DisplayName: target.DisplayName,
        Kind: "invalidInventoryUpdate",
        Details: { test: true },
        CreatedAt: new Date()
    });
    await Session.create({
        creatorId: inviter._id,
        gameModeId: 1,
        regionId: 1,
        hasStarted: false,
        buildId: 1n,
        members: [{ accountId: target._id, slotType: "public" }],
        lastUpdate: new Date()
    });

    config.administratorNames = [target.DisplayName];
    config.accountDropMultipliers = { [target.DisplayName]: { resourceMultiplier: 2 } };
    config.accountRateProfiles = { [target._id.toString()]: { creditMultiplier: 2 } };
    config.accountFeatureProfiles = { [target._id.toString()]: { infiniteHelminthMaterials: true } };

    await deleteAccountData(target);

    assert.equal(await Account.exists({ _id: target._id }), null);
    assert.equal(await Account.exists({ _id: referred._id, ReferredBy: target._id }), null);
    assert.equal((await Account.findById(referred._id))?.ReferredBy, undefined);
    assert.equal((await Account.findById(inviter._id))?.ReferralCount, 0);
    assert.equal(await Friendship.countDocuments({ $or: [{ owner: target._id }, { friend: target._id }] }), 0);
    assert.equal(await Ignore.countDocuments({ $or: [{ ignorer: target._id }, { ignoree: target._id }] }), 0);
    assert.equal(await Inbox.countDocuments({ ownerId: target._id }), 0);
    assert.equal(await Inventory.countDocuments({ accountOwnerId: target._id }), 0);
    assert.equal(await Loadout.countDocuments({ loadoutOwnerId: target._id }), 0);
    assert.equal(await PersonalRooms.countDocuments({ personalRoomsOwnerId: target._id }), 0);
    assert.equal(await Ship.countDocuments({ ShipOwnerId: target._id }), 0);
    assert.equal(await Stats.countDocuments({ accountOwnerId: target._id }), 0);
    assert.equal(await GuildMember.countDocuments({ accountId: target._id }), 0);
    assert.equal(await Leaderboard.countDocuments({ ownerId: target._id }), 0);
    assert.equal(await PendingTrade.countDocuments({ $or: [{ a: target._id }, { b: target._id }] }), 0);
    assert.equal(await CurrencyGrantStat.countDocuments({ AccountOwnerId: target._id }), 0);
    assert.equal(await InvasionRewardClaim.countDocuments({ accountId: target._id }), 0);
    assert.equal(await PlayerMarketCounter.countDocuments({ scope: target._id.toString() }), 0);
    assert.equal(await PlayerMarketLedger.countDocuments({ accountId: target._id }), 0);
    assert.equal(await PlayerPresence.countDocuments({ AccountId: target._id }), 0);
    assert.equal(await PlayerPresenceEvent.countDocuments({ AccountId: target._id }), 0);
    assert.equal(await PlayerSession.countDocuments({ accountId: target._id }), 0);
    assert.equal(await SuspicionEvent.countDocuments({ AccountId: target._id }), 0);
    assert.equal(await Session.countDocuments({ "members.accountId": target._id }), 0);
    assert.equal(config.administratorNames.includes(target.DisplayName), false);
    assert.equal(config.accountDropMultipliers[target.DisplayName], undefined);
    assert.equal(config.accountRateProfiles[target._id.toString()], undefined);
    assert.equal(config.accountFeatureProfiles[target._id.toString()], undefined);
});
