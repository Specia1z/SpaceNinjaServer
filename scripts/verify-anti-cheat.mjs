// Verifies the settlement anti-cheat checks by driving the real controller against a real MongoDB.
// Run with: node --experimental-strip-types scripts/verify-anti-cheat.mjs
// Requires a prior build: npm run build
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
const testDataDir = path.resolve("node_modules/.cache/sns-verify-db-anticheat");
fs.rmSync(testDataDir, { recursive: true, force: true });
fs.mkdirSync(testDataDir, { recursive: true });
const mongod = await MongoMemoryServer.create({
    binary: { version: "7.0.34", downloadDir: "node_modules/.cache" },
    instance: { dbPath: testDataDir, portGeneration: true }
});
await mongoose.connect(mongod.getUri() + "openWF");
console.log("connected to", mongoose.connection.name);

// The server patches the global JSON.stringify in src/index.ts so BigInt values (Inventory.RewardSeed,
// Session.rewardSeed, ...) serialise cleanly. Reproduce that bootstrap step, otherwise building the
// controller's InventoryJson response throws "Do not know how to serialize a BigInt".
const { JSONStringify, JSONParse } = await import("json-with-bigint");
JSON.stringify = JSONStringify;

const { config } = await import("../build/src/services/configService.js");
const { logger } = await import("../build/src/utils/logger.js");
const { Account } = await import("../build/src/models/loginModel.js");
const { Inventory } = await import("../build/src/models/inventoryModels/inventoryModel.js");
const { Session } = await import("../build/src/models/sessionModel.js");
const { missionInventoryUpdateController } =
    await import("../build/src/controllers/api/missionInventoryUpdateController.js");
const { verifyRewardSeed } = await import("../build/src/services/antiCheatService.js");

// ---------------------------------------------------------------- capture anti-cheat warnings
// The real code runs untouched; only the log sink is replaced. Without this the logger has no
// transports attached (initLogger is never called here) and winston falls back to console.error
// with %j, which cannot serialise the BigInt rewardSeed carried in the report metadata.
const captured = [];
for (const level of ["error", "warn", "info", "http", "debug", "trace"]) {
    logger[level] = (message, ...meta) => {
        captured.push({ level, message: String(message), metadata: meta[0] });
    };
}
const drainWarnings = () => captured.splice(0, captured.length);
const drainAntiCheatWarnings = () =>
    drainWarnings().filter(entry => entry.level === "warn" && entry.message.startsWith("[anti-cheat]"));
/** Peek (without draining) at everything logged since the last drain. */
const sawLog = fragment => captured.some(entry => entry.message.includes(fragment));

const TEST_PREFIX = "SNS-AC";
const NONCE = 12345;
const SESSION_SEED = "6507355989039747075";
const TAMPERED_SEED = "1111111111111111111";

STEP("wipe stale fixtures");
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
console.log("    done");

STEP("seed a test account + inventory + session");
const account = await Account.create({
    DisplayName: `${TEST_PREFIX}-A`,
    email: "sns-ac-a@example.com",
    password: "x",
    Nonce: NONCE,
    BuildLabel: "2024.01.01.00.00"
});
const suitId = new mongoose.Types.ObjectId();
await Inventory.create({
    accountOwnerId: account._id,
    Suits: [{ ItemId: suitId, ItemType: "/Lotus/Powersuits/Excalibur/Excalibur", XP: 0 }],
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
    CompletedAlerts: [],
    XPInfo: []
});
const session = await Session.create({
    gameModeId: 0,
    regionId: 3,
    hasStarted: false,
    buildId: 202603241659n,
    creatorId: account._id,
    rewardSeed: BigInt(SESSION_SEED),
    lastUpdate: new Date()
});
console.log(`    account=${account._id} session=${session._id} seed=${session.rewardSeed}`);

// ---------------------------------------------------------------- request plumbing
const BASE_REPORT = {
    MissionFailed: false,
    MissionStatus: "GS_SUCCESS",
    AliveTime: 300,
    MissionTime: 300,
    Missions: { Tag: "SolNode1", Completes: 1, Tier: 0 },
    RegularCredits: 0,
    PS: "verify",
    MissionPTS: 0,
    RepHash: "verify",
    EndOfMatchUpload: true,
    sharedSessionId: session._id.toString(),
    RewardInfo: { node: "SolNode1", rewardSeed: "__SEED__" },
    ChallengeProgress: [],
    hosts: [],
    currentClients: [],
    GameModeId: 0,
    LevelKeyName: "SolNode1",
    ObjectiveReached: true,
    PlayerSkillGains: {},
    ActiveDojoColorResearch: "",
    ReceivedCeremonyMsg: false,
    LastCeremonyResetDate: 0,
    FpsAvg: 60,
    FpsMin: 60,
    FpsMax: 60,
    FpsSamples: 1
};

// rewardSeed must reach the parser as a raw JSON integer so json-with-bigint yields a BigInt.
const buildReportText = ({ seed = SESSION_SEED, ...overrides } = {}) =>
    JSON.stringify({ ...BASE_REPORT, ...overrides }).replace('"__SEED__"', seed);

const callController = async reportText => {
    const req = {
        query: { accountId: account._id.toString(), nonce: String(NONCE) },
        body: reportText
    };
    let payload;
    const res = {
        json: value => {
            payload = value;
        }
    };
    await missionInventoryUpdateController(req, res);
    return payload;
};

const readInventory = () => Inventory.findOne({ accountOwnerId: account._id });

const antiCheatConfig = {
    enabled: true,
    enforce: false,
    minMissionTimeSec: 20,
    maxMissionCompletesPerReport: 10,
    maxXpPerMissionSecond: 100000
};
const setConfig = patch => {
    config.antiCheat = { ...antiCheatConfig, ...patch };
};

STEP("baseline: a legitimate report raises no anti-cheat warning");
setConfig({});
drainWarnings();
{
    const payload = await callController(buildReportText());
    const flagged = drainAntiCheatWarnings();
    assert(payload != undefined, "controller produced a response payload");
    assert(flagged.length === 0, `no anti-cheat warnings on a clean report (got ${flagged.length})`);
}

STEP("disabled: the whole check suite is skipped");
setConfig({ enabled: false });
drainWarnings();
{
    await callController(buildReportText({ seed: TAMPERED_SEED, MissionTime: 1, AliveTime: 1 }));
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 0, `enabled=false suppresses all checks (got ${flagged.length})`);
}

STEP("reward seed mismatch is detected (enforce off keeps the settlement intact)");
setConfig({});
drainWarnings();
{
    const payload = await callController(buildReportText({ seed: TAMPERED_SEED }));
    const rewardPathRan = sawLog("classic mission completion");
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 1, `exactly one warning (got ${flagged.length})`);
    assert(flagged[0].message === "[anti-cheat] rewardSeedMismatch", `kind is rewardSeedMismatch`);
    assert(flagged[0].metadata.expected === SESSION_SEED, `metadata carries the expected seed`);
    assert(flagged[0].metadata.reported === TAMPERED_SEED, `metadata carries the reported seed`);
    assert(Array.isArray(payload.MissionRewards), "rewards are still granted when enforce is off");
    assert(rewardPathRan, "the settlement still went through the normal reward path");
}

STEP("reward seed mismatch with enforce on rewrites the report back to the server-issued seed");
setConfig({ enforce: true });
drainWarnings();
{
    // The controller parses the body internally, so drive the check on an already-parsed report to
    // observe the correction. JSONParse (not JSON.parse) keeps the 64-bit seed exact, as the server does.
    const report = JSONParse(buildReportText({ seed: TAMPERED_SEED }));
    const ok = await verifyRewardSeed(account, report);
    const flagged = drainAntiCheatWarnings();
    assert(ok === false, "the check reports a mismatch");
    assert(flagged.length === 1, `one warning (got ${flagged.length})`);
    assert(
        BigInt(report.RewardInfo.rewardSeed) === BigInt(SESSION_SEED),
        `the report was corrected to the session seed (got ${report.RewardInfo.rewardSeed})`
    );
}

STEP("impossible mission time is detected (enforce off keeps the settlement intact)");
setConfig({});
drainWarnings();
{
    const payload = await callController(buildReportText({ MissionTime: 9, AliveTime: 9 }));
    const rewardPathRan = sawLog("classic mission completion");
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 1, `exactly one warning (got ${flagged.length})`);
    assert(flagged[0].message === "[anti-cheat] impossibleMissionTime", "kind is impossibleMissionTime");
    assert(flagged[0].metadata.missionTime === 9, "metadata carries the reported mission time");
    assert(Array.isArray(payload.MissionRewards), "rewards are still granted when enforce is off");
    assert(rewardPathRan, "the settlement still went through the normal reward path");
}

STEP("enforce on rejects the whole report, including client-supplied credits");
setConfig({ enforce: true });
await Inventory.updateOne({ accountOwnerId: account._id }, { $set: { RegularCredits: 0 } });
drainWarnings();
{
    const payload = await callController(buildReportText({ MissionTime: 9, AliveTime: 9, RegularCredits: 5_000_000 }));
    const rejected = sawLog("anti-cheat check failed, refusing to process mission report");
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 1, `one warning (got ${flagged.length})`);
    assert(rejected, "the rejection path was taken");
    assert(payload.MissionRewards.length === 0, "no mission rewards handed out");
    const after = await readInventory();
    assert(
        after.RegularCredits === 0,
        `client-supplied RegularCredits were discarded (expected 0, got ${after.RegularCredits})`
    );
}

STEP("alive time exceeding mission time is detected");
setConfig({});
drainWarnings();
{
    await callController(buildReportText({ MissionTime: 300, AliveTime: 400 }));
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 1, `one warning (got ${flagged.length})`);
    assert(flagged[0].metadata.reason === "aliveTimeExceedsMissionTime", "reason identifies the inconsistency");
}

STEP("excessive mission completes are clamped even when enforce is off");
setConfig({});
await Inventory.updateOne({ accountOwnerId: account._id }, { $set: { Missions: [] } });
drainWarnings();
{
    await callController(buildReportText({ Missions: { Tag: "SolNode1", Completes: 9999, Tier: 0 } }));
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 1, `one warning (got ${flagged.length})`);
    assert(flagged[0].message === "[anti-cheat] excessiveMissionCompletes", "kind is excessiveMissionCompletes");
    const inventory = await readInventory();
    const entry = inventory.Missions.find(m => m.Tag === "SolNode1");
    assert(entry != undefined, "the mission entry was recorded");
    assert(entry.Completes === 10, `completes clamped to the configured cap (got ${entry.Completes})`);
}

STEP("excessive xp rate is detected");
setConfig({});
drainWarnings();
{
    await callController(
        buildReportText({
            MissionTime: 300,
            AliveTime: 300,
            Suits: [{ ItemId: { $oid: suitId.toString() }, XP: 999_999_999 }]
        })
    );
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 1, `one warning (got ${flagged.length})`);
    assert(flagged[0].message === "[anti-cheat] excessiveXpGain", "kind is excessiveXpGain");
    assert(flagged[0].metadata.totalXp === 999_999_999, "metadata carries the reported xp total");
    assert(flagged[0].metadata.xpPerSecond === 3_333_333, `xp/s derived from mission time`);
}

STEP("a report without a session id is not judged on its seed");
setConfig({});
drainWarnings();
{
    await callController(buildReportText({ seed: TAMPERED_SEED, sharedSessionId: "" }));
    const flagged = drainAntiCheatWarnings();
    assert(flagged.length === 0, `no seed verdict without a session (got ${flagged.length})`);
}

STEP("cleanup");
await Account.deleteMany({ DisplayName: { $regex: `^${TEST_PREFIX}` } });
await Inventory.deleteMany({ accountOwnerId: account._id });
await Session.deleteMany({ creatorId: account._id });
console.log("    done");

console.log("\n=== ALL CHECKS PASSED ===");
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
