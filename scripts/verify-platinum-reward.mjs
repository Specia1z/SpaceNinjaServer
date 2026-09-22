// Verifies the mission platinum reward chance and the mail opt-in, driving the real service code.
// Run with: node --experimental-strip-types scripts/verify-platinum-reward.mjs
import path from "node:path";
import fs from "node:fs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";

const STEP = (() => {
    let n = 0;
    return msg => console.log(`\n[${++n}] ${msg}`);
})();
const assert = (cond, msg) => {
    if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
    console.log(`    ok - ${msg}`);
};

// ---------------------------------------------------------------- boot embedded mongo
const testDataDir = path.resolve("node_modules/.cache/sns-verify-db-platinum");
fs.rmSync(testDataDir, { recursive: true, force: true });
fs.mkdirSync(testDataDir, { recursive: true });
const mongod = await MongoMemoryServer.create({
    binary: { version: "7.0.34", downloadDir: "node_modules/.cache" },
    instance: { dbPath: testDataDir, portGeneration: true }
});
await mongoose.connect(mongod.getUri() + "openWF");
console.log("connected to", mongoose.connection.name);

const { config } = await import("../build/src/services/configService.js");
const { Account } = await import("../build/src/models/loginModel.js");
const { Inventory } = await import("../build/src/models/inventoryModels/inventoryModel.js");
const { Inbox } = await import("../build/src/models/inboxModel.js");
const { addMissionRewards } = await import("../build/src/services/missionInventoryUpdateService.js");

const TEST_PREFIX = "SNS-PLAT";

STEP("wipe stale fixtures");
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
console.log("    done");

STEP("seed a test account + inventory");
const account = await Account.create({
    DisplayName: `${TEST_PREFIX}-A`,
    email: "sns-plat-a@example.com",
    password: "x"
});
const emptyInventory = {
    accountOwnerId: account._id,
    Suits: [],
    LongGuns: [],
    Pistols: [],
    Melee: [],
    Sentinels: [],
    SentinelWeapons: [],
    MiscItems: [],
    FlavourItems: [],
    Recipes: [],
    WeaponSkins: [],
    UpgradeTypes: [],
    CrewMembers: [],
    KubrowPets: [],
    Boosters: [],
    RawUpgrades: [],
    RegularCredits: 0,
    PremiumCredits: 0,
    PremiumCreditsFree: 0,
    FusionPoints: 0,
    PlayerLevel: 0,
    Missions: [],
    DailyAffiliation: 0,
    AffiliationPoints: [],
    PendingAffiliations: [],
    CompletedJobs: [],
    DeathMarks: [],
    EvolutionProgress: [],
    EmailItems: [],
    Goals: [],
    CompletedAlerts: []
};
await Inventory.create(emptyInventory);
console.log("    seeded");

// A real, minimal mission reward request. addMissionRewards only needs RewardInfo to exist for the platinum
// roll to run; the drop table itself is irrelevant to what we are testing.
const rewardRequest = inventory => ({
    RewardInfo: { node: "SolNode1" },
    Missions: { Tag: "SolNode1" },
    MissionStatus: "GS_SUCCESS",
    inventory
});

const runMission = async () => {
    const inventory = await Inventory.findOne({ accountOwnerId: account._id });
    inventory.PremiumCredits = 0;
    inventory.pendingPremiumCredits = undefined;
    const request = rewardRequest(inventory);
    const { inventoryChanges } = await addMissionRewards(
        account,
        "2024.01.01.00.00",
        inventory,
        {
            RewardInfo: request.RewardInfo,
            Missions: request.Missions,
            MissionStatus: request.MissionStatus
        },
        false
    );
    await inventory.save();
    return { inventory, inventoryChanges };
};

STEP("default config: unset chance means every mission pays out");
delete config.missionPlatinumRewardChance;
delete config.missionPlatinumRewardSendMail;
config.missionPlatinumRewardMin = 10;
config.missionPlatinumRewardMax = 20;
{
    let hits = 0;
    let allInRange = true;
    for (let i = 0; i != 40; ++i) {
        const { inventory } = await runMission();
        const credited = inventory.PremiumCredits;
        if (credited > 0) {
            hits++;
            if (credited < 10 || credited > 20) allInRange = false;
        }
    }
    assert(hits === 40, `all 40 missions paid out (got ${hits})`);
    assert(allInRange, "every payout stayed within [10, 20]");
}

STEP("unset sendMail defaults to no mail, platinum lands in the balance");
{
    const { inventory, inventoryChanges } = await runMission();
    assert(inventory.PremiumCredits >= 10, `PremiumCredits credited directly (got ${inventory.PremiumCredits})`);
    assert(inventory.pendingPremiumCredits == undefined, "nothing queued for the inbox");
    assert(
        inventoryChanges.PremiumCredits === inventory.PremiumCredits,
        `InventoryChanges.PremiumCredits reports the credit (got ${inventoryChanges.PremiumCredits})`
    );
    const mailCount = await Inbox.countDocuments({ ownerId: account._id });
    assert(mailCount === 0, `no inbox message created (got ${mailCount})`);
}

STEP("chance 0 never pays out");
config.missionPlatinumRewardChance = 0;
{
    let hits = 0;
    for (let i = 0; i != 40; ++i) {
        const { inventory } = await runMission();
        if (inventory.PremiumCredits > 0) hits++;
    }
    assert(hits === 0, `40 missions, 0 payouts (got ${hits})`);
}

STEP("chance 100 always pays out");
config.missionPlatinumRewardChance = 100;
{
    let hits = 0;
    for (let i = 0; i != 40; ++i) {
        const { inventory } = await runMission();
        if (inventory.PremiumCredits > 0) hits++;
    }
    assert(hits === 40, `40 missions, 40 payouts (got ${hits})`);
}

STEP("chance 50 lands statistically near half over 4000 rolls");
config.missionPlatinumRewardChance = 50;
{
    const trials = 4000;
    let hits = 0;
    for (let i = 0; i != trials; ++i) {
        const { inventory } = await runMission();
        if (inventory.PremiumCredits > 0) hits++;
    }
    const rate = (hits / trials) * 100;
    console.log(`    observed payout rate: ${rate.toFixed(2)}% over ${trials} missions`);
    assert(rate > 45 && rate < 55, `payout rate near 50% (got ${rate.toFixed(2)}%)`);
}

STEP("chance 25 lands statistically near a quarter over 4000 rolls");
config.missionPlatinumRewardChance = 25;
{
    const trials = 4000;
    let hits = 0;
    for (let i = 0; i != trials; ++i) {
        const { inventory } = await runMission();
        if (inventory.PremiumCredits > 0) hits++;
    }
    const rate = (hits / trials) * 100;
    console.log(`    observed payout rate: ${rate.toFixed(2)}% over ${trials} missions`);
    assert(rate > 21 && rate < 29, `payout rate near 25% (got ${rate.toFixed(2)}%)`);
}

STEP("sendMail opt-in restores the inbox message and leaves the balance alone");
config.missionPlatinumRewardChance = 100;
config.missionPlatinumRewardSendMail = true;
await Inbox.deleteMany({ ownerId: account._id });
{
    const { inventory, inventoryChanges } = await runMission();
    assert(inventory.PremiumCredits === 0, `balance untouched (got ${inventory.PremiumCredits})`);
    assert(inventory.pendingPremiumCredits >= 10, `platinum queued for inbox (got ${inventory.pendingPremiumCredits})`);
    assert(inventoryChanges.PremiumCredits === undefined, "no direct-credit delta reported");
}
console.log("    (the queued amount is turned into a message by dispatchPendingPremiumCredits on the next login)");

STEP("zero range still short-circuits before any roll");
config.missionPlatinumRewardSendMail = false;
config.missionPlatinumRewardMin = 0;
config.missionPlatinumRewardMax = 0;
{
    const { inventory } = await runMission();
    assert(
        inventory.PremiumCredits === 0 && !inventory.pendingPremiumCredits,
        "no platinum awarded when the range is 0"
    );
}

STEP("cleanup");
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
await Inventory.deleteMany({ accountOwnerId: account._id });
await Inbox.deleteMany({ ownerId: account._id });
console.log("    done");

console.log("\n=== ALL CHECKS PASSED ===");
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
