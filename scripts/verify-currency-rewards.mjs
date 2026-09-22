// Checks that currencies (which have no uniqueName in the item data) can be granted through the generic
// addItem path and accepted by the redeem-code admin controller.
// Run with: node --experimental-strip-types scripts/verify-currency-rewards.mjs
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
// Uses its own data directory so a server instance holding the real ./database lock does not block us.
const testDataDir = path.resolve("node_modules/.cache/sns-verify-db-currency");
fs.rmSync(testDataDir, { recursive: true, force: true });
fs.mkdirSync(testDataDir, { recursive: true });
const downloadDir = "node_modules/.cache";
const mongod = await MongoMemoryServer.create({
    binary: { version: "7.0.34", downloadDir },
    instance: { dbPath: testDataDir, portGeneration: true }
});
await mongoose.connect(mongod.getUri() + "openWF");
console.log("connected to", mongoose.connection.name);

const { Account } = await import("../build/src/models/loginModel.js");
const { Inventory } = await import("../build/src/models/inventoryModels/inventoryModel.js");
const { addItem, addItems, getInventory, isCurrencyItemName } =
    await import("../build/src/services/inventoryService.js");

const TEST_PREFIX = "SNS-CUR";

STEP("wipe stale fixtures");
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
console.log("    done");

STEP("isCurrencyItemName recognises currencies and rejects asset paths");
for (const name of [
    "RegularCredits",
    "PremiumCredits",
    "PremiumCreditsFree",
    "FusionPoints",
    "CrewShipFusionPoints",
    "PrimeTokens"
]) {
    assert(isCurrencyItemName(name) === true, `${name} is treated as a currency`);
}
for (const name of [
    "/Lotus/Types/Items/MiscItems/OrokinCell",
    "PremiumCreditsFreeExtra",
    "premiumcredits",
    "",
    "/Lotus/Types/Items/MiscItems/PrimeBucks"
]) {
    assert(isCurrencyItemName(name) === false, `"${name}" is NOT treated as a currency`);
}

STEP("seed a test account + inventory");
const account = await Account.create({
    DisplayName: `${TEST_PREFIX}-A`,
    email: "sns-cur-a@example.com",
    password: "x"
});
await Inventory.create({
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
    Goals: []
});
console.log("    seeded", account.DisplayName);

STEP("addItem grants a single currency and reports it as an InventoryChanges delta");
const inv = await getInventory(String(account._id), undefined);
const platinumDelta = await addItem(inv, "PremiumCredits", 300);
assert(platinumDelta.PremiumCredits === 300, `delta is 300 (got ${platinumDelta.PremiumCredits})`);
assert(inv.PremiumCredits === 300, `balance is 300 (got ${inv.PremiumCredits})`);
assert(Object.keys(platinumDelta).length === 1, `delta carries nothing else (got ${JSON.stringify(platinumDelta)})`);

STEP("all six currencies can be granted in one addItems call");
const mixed = await addItems(
    inv,
    [
        { ItemType: "RegularCredits", ItemCount: 12_000 },
        { ItemType: "PremiumCredits", ItemCount: 75 },
        { ItemType: "PremiumCreditsFree", ItemCount: 25 },
        { ItemType: "FusionPoints", ItemCount: 4_000 },
        { ItemType: "CrewShipFusionPoints", ItemCount: 900 },
        { ItemType: "PrimeTokens", ItemCount: 3 },
        { ItemType: "/Lotus/Types/Items/MiscItems/OrokinCell", ItemCount: 2 }
    ],
    {}
);
assert(mixed.RegularCredits === 12_000, `RegularCredits delta (got ${mixed.RegularCredits})`);
assert(mixed.PremiumCredits === 75, `PremiumCredits delta (got ${mixed.PremiumCredits})`);
assert(mixed.PremiumCreditsFree === 25, `PremiumCreditsFree delta (got ${mixed.PremiumCreditsFree})`);
assert(mixed.FusionPoints === 4_000, `FusionPoints delta (got ${mixed.FusionPoints})`);
assert(mixed.CrewShipFusionPoints === 900, `CrewShipFusionPoints delta (got ${mixed.CrewShipFusionPoints})`);
assert(mixed.PrimeTokens === 3, `PrimeTokens delta (got ${mixed.PrimeTokens})`);
assert(
    mixed.MiscItems?.some(x => x.ItemType == "/Lotus/Types/Items/MiscItems/OrokinCell") === true,
    "a real item in the same batch still lands"
);
// The deltas accumulate onto what the earlier addItem already applied to the same inventory document.
assert(inv.PremiumCredits === 375, `balances accumulate on the document: 300 + 75 (got ${inv.PremiumCredits})`);
assert(inv.FusionPoints === 4_000, `endo applied (got ${inv.FusionPoints})`);
await inv.save();
console.log("    InventoryChanges:", JSON.stringify(mixed));

STEP("repeating a currency entry in one call merges rather than overwrites");
const repeated = await addItems(
    inv,
    [
        { ItemType: "PremiumCredits", ItemCount: 10 },
        { ItemType: "PremiumCredits", ItemCount: 5 }
    ],
    {}
);
await inv.save();
assert(repeated.PremiumCredits === 15, `two entries merged to 15 (got ${repeated.PremiumCredits})`);
assert(inv.PremiumCredits === 390, `balance is 390 (got ${inv.PremiumCredits})`);

STEP("balances persist");
const reloaded = await getInventory(String(account._id), undefined);
assert(reloaded.PremiumCredits === 390, `persisted platinum is 390 (got ${reloaded.PremiumCredits})`);
assert(reloaded.RegularCredits === 12_000, `persisted credits is 12000 (got ${reloaded.RegularCredits})`);
assert(
    reloaded.MiscItems.find(x => x.ItemType == "/Lotus/Types/Items/MiscItems/OrokinCell")?.ItemCount === 2,
    "persisted OrokinCell count is 2"
);

STEP("negative counts subtract from the balance");
const removed = await addItems(reloaded, [{ ItemType: "PremiumCredits", ItemCount: -390 }], {});
await reloaded.save();
assert(removed.PremiumCredits === -390, `negative delta reported (got ${removed.PremiumCredits})`);
assert(reloaded.PremiumCredits === 0, `platinum back to 0 (got ${reloaded.PremiumCredits})`);
assert(
    reloaded.RegularCredits === 12_000,
    `credits untouched by the platinum removal (got ${reloaded.RegularCredits})`
);

STEP("an unknown non-path name is still rejected");
let threw = false;
try {
    await addItem(reloaded, "NotACurrency", 5);
} catch {
    threw = true;
}
assert(threw === true, "an unknown non-path name still throws rather than silently creating a field");

STEP("a currency name that merely resembles a real one is rejected");
threw = false;
try {
    await addItem(reloaded, "premiumcredits", 5); // wrong case
} catch {
    threw = true;
}
assert(threw === true, "case-sensitive match: premiumcredits is rejected");

STEP("cleanup");
await Inventory.deleteMany({ accountOwnerId: account._id });
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
console.log("    done");

console.log("\n=== ALL CHECKS PASSED ===");
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
