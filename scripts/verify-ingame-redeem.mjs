// End-to-end check of the in-game redemption endpoint (/api/redeemPromoCode.php).
// Boots the same embedded MongoDB the server uses, then asserts the full redemption flow.
// Run with: node --experimental-strip-types scripts/verify-ingame-redeem.mjs
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
const testDataDir = path.resolve("node_modules/.cache/sns-verify-db");
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
const { RedeemCode } = await import("../build/src/models/redeemCodeModel.js");
const { initializeRedeemCodes, redeemCode } = await import("../build/src/services/redeemCodeService.js");
const { addItems, getInventory } = await import("../build/src/services/inventoryService.js");
const glyphCodes = JSON.parse(fs.readFileSync("static/fixed_responses/glyphsCodes.json", "utf8"));

const TEST_PREFIX = "SNS-TEST";
const testCode = `${TEST_PREFIX}INGAME1`;

STEP("wipe stale fixtures");
await RedeemCode.deleteMany({ Code: { $regex: `^${TEST_PREFIX}` } });
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
console.log("    done");

STEP("seed a test account + inventory + a custom code");
const account = await Account.create({
    DisplayName: `${TEST_PREFIX}-A`,
    email: "sns-test-a@example.com",
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
};
await Inventory.create({ ...emptyInventory, accountOwnerId: account._id });

await RedeemCode.create({
    Code: testCode,
    Label: "in-game test",
    Rewards: [
        { ItemType: "/Lotus/Types/Items/MiscItems/OrokinCell", ItemCount: 7 },
        { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 3 }
    ],
    MaxUses: 1,
    Uses: 0,
    UsedBy: [],
    Enabled: true,
    CreatedBy: `${TEST_PREFIX}-A`
});
await initializeRedeemCodes();
console.log("    seeded", testCode);

STEP("custom code resolves for the account");
const first = await redeemCode(testCode, String(account._id));
assert(first.ok === true, "first redemption succeeds");
assert(first.rewards.length === 2, `carries 2 reward entries (got ${first.rewards.length})`);

STEP("a code can grant currencies alongside items");
// Currencies are inventory numbers rather than items with a uniqueName, so they are addressed by field name.
const currencyCode = `${TEST_PREFIX}CURRENCY`;
await RedeemCode.create({
    Code: currencyCode,
    Label: "currency test",
    Rewards: [
        { ItemType: "PremiumCredits", ItemCount: 250 },
        { ItemType: "RegularCredits", ItemCount: 5_000 },
        { ItemType: "FusionPoints", ItemCount: 100 },
        { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 1 }
    ],
    MaxUses: 0,
    Uses: 0,
    UsedBy: [],
    Enabled: true,
    CreatedBy: `${TEST_PREFIX}-A`
});
await initializeRedeemCodes();
const currencyRedeem = await redeemCode(currencyCode, String(account._id));
assert(currencyRedeem.ok === true, "currency code redeems successfully");

const currencyInv = await getInventory(String(account._id), undefined);
const beforePlatinum = currencyInv.PremiumCredits;
const beforeCredits = currencyInv.RegularCredits;
const beforeEndo = currencyInv.FusionPoints;
const currencyChanges = await addItems(currencyInv, currencyRedeem.rewards, {});
await currencyInv.save();

assert(currencyChanges.PremiumCredits === 250, `PremiumCredits delta is 250 (got ${currencyChanges.PremiumCredits})`);
assert(
    currencyChanges.RegularCredits === 5_000,
    `RegularCredits delta is 5000 (got ${currencyChanges.RegularCredits})`
);
assert(currencyChanges.FusionPoints === 100, `FusionPoints delta is 100 (got ${currencyChanges.FusionPoints})`);
assert(
    currencyInv.PremiumCredits === beforePlatinum + 250,
    `platinum balance went ${beforePlatinum} -> ${currencyInv.PremiumCredits}`
);
assert(
    currencyInv.RegularCredits === beforeCredits + 5_000,
    `credit balance went ${beforeCredits} -> ${currencyInv.RegularCredits}`
);
assert(currencyInv.FusionPoints === beforeEndo + 100, `endo balance went ${beforeEndo} -> ${currencyInv.FusionPoints}`);
assert(
    currencyChanges.MiscItems?.some(x => x.ItemType == "/Lotus/Types/Items/MiscItems/Ferrite") === true,
    "items in the same code still land normally"
);

STEP("currencies can be removed with a negative count");
const negativeChanges = await addItems(currencyInv, [{ ItemType: "PremiumCredits", ItemCount: -50 }], {});
await currencyInv.save();
assert(negativeChanges.PremiumCredits === -50, `negative delta reported (got ${negativeChanges.PremiumCredits})`);
assert(
    currencyInv.PremiumCredits === beforePlatinum + 200,
    `platinum balance after removal is ${currencyInv.PremiumCredits}`
);

STEP("same account cannot redeem it twice");
// with MaxUses=1 the code is exhausted after the first redemption, which the service reports first
const second = await redeemCode(testCode, String(account._id));
assert(
    second.ok === false && second.reason === "EXHAUSTED_CODE",
    `rejected with EXHAUSTED_CODE (got ${second.reason})`
);

STEP("a multi-use code still refuses a repeat redemption by the same account");
const repeatCode = `${TEST_PREFIX}REPEAT`;
await RedeemCode.create({
    Code: repeatCode,
    Rewards: [{ ItemType: "/Lotus/Types/Items/MiscItems/OrokinCell", ItemCount: 1 }],
    MaxUses: 0, // unlimited
    Uses: 0,
    UsedBy: [],
    Enabled: true,
    CreatedBy: `${TEST_PREFIX}-A`
});
await initializeRedeemCodes();
const repeatFirst = await redeemCode(repeatCode, String(account._id));
assert(repeatFirst.ok === true, "unlimited code redeemed once");
const repeatSecond = await redeemCode(repeatCode, String(account._id));
assert(
    repeatSecond.ok === false && repeatSecond.reason === "USED_CODE",
    `same account blocked by the per-account limit (got ${repeatSecond.reason})`
);

STEP("unknown code is rejected");
const unknown = await redeemCode(`${TEST_PREFIX}NOPE`, String(account._id));
assert(unknown.ok === false && unknown.reason === "INVALID_CODE", `INVALID_CODE (got ${unknown.reason})`);

STEP("glyph codes still resolve, case-insensitively");
const glyphKeys = Object.keys(glyphCodes);
const lower = "kavatsschroedinger";
const glyphMatch = glyphKeys.find(x => x.toUpperCase() == lower.toUpperCase());
assert(glyphMatch === "KAVATSSCHROEDINGER", `"${lower}" -> KAVATSSCHROEDINGER (got ${glyphMatch})`);

STEP("rewards land in the inventory as InventoryChanges");
const inv = await getInventory(String(account._id), undefined);
const changes = await addItems(inv, first.rewards, {});
await inv.save();
const cell = changes.MiscItems?.find(x => x.ItemType == "/Lotus/Types/Items/MiscItems/OrokinCell");
assert(cell !== undefined, "OrokinCell present in MiscItems delta");
assert(cell.ItemCount === 7, `OrokinCell delta is 7 (got ${cell?.ItemCount})`);
console.log("    InventoryChanges:", JSON.stringify(changes));

const reloaded = await getInventory(String(account._id), undefined);
const stored = reloaded.MiscItems.find(x => x.ItemType == "/Lotus/Types/Items/MiscItems/OrokinCell");
assert(stored?.ItemCount === 7, `persisted OrokinCell count is 7 (got ${stored?.ItemCount})`);

STEP("previously-missing glyph is now grantable (ExportFlavour fallback)");
const missingGlyph = "/Lotus/Types/StoreItems/AvatarImages/FanChannel/AvatarImageKavatsSchroedinger";
const glyphChanges = await addItems(reloaded, [{ ItemType: missingGlyph, ItemCount: 1 }], {});
assert(
    glyphChanges.FlavourItems?.some(x => x.ItemType == missingGlyph) === true,
    "KAVATSSCHROEDINGER glyph granted despite being absent from public-export data"
);
await reloaded.save();

STEP("no glyph code regressed - every entry resolves");
const { ExportFlavour } = await import("warframe-public-export-plus");
const flavourPrefixes = [
    "/Lotus/Interface/Graphics/CustomUI/",
    "/Lotus/Types/Game/ActionFigureDioramas/",
    "/Lotus/Types/Game/CatbrowPet/",
    "/Lotus/Types/Game/KubrowPet/Colors/",
    "/Lotus/Types/Game/NotePacks/",
    "/Lotus/Types/Game/PoseSets/",
    "/Lotus/Types/Game/QuartersWallpapers/",
    "/Lotus/Types/Game/ShipScenes/",
    "/Lotus/Types/Items/Arcade/",
    "/Lotus/Types/Items/Emotes/",
    "/Lotus/Types/Items/Events/",
    "/Lotus/Types/Items/Titles/",
    "/Lotus/Types/Items/VideoWallBackdrops/",
    "/Lotus/Types/Items/VideoWallSoundscapes/",
    "/Lotus/Types/StoreItems/AvatarImages/",
    "/Lotus/Types/StoreItems/SuitCustomizations/",
    "/Lotus/Upgrades/Skins/"
];
let unresolved = 0;
for (const c of glyphKeys) {
    for (const item of glyphCodes[c]) {
        const inData = item in ExportFlavour;
        const viaFallback = flavourPrefixes.some(x => item.startsWith(x));
        if (!inData && !viaFallback) {
            unresolved++;
            console.log("    UNRESOLVED:", c, item);
        }
    }
}
assert(unresolved === 0, `all entries across ${glyphKeys.length} glyph codes resolve`);

STEP("cleanup");
await RedeemCode.deleteMany({ Code: { $regex: `^${TEST_PREFIX}` } });
await Inventory.deleteMany({ accountOwnerId: account._id });
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
await initializeRedeemCodes();
console.log("    done");

console.log("\n=== ALL CHECKS PASSED ===");
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
