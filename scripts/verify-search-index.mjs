// Guards the admin item picker's search index against non-grantable entries.
//
// Background: the WebUI builds window.itemSearchIndex by flattening every array returned by
// /custom/getItemLists. AdditionalDict is an array of /Lotus/Language/... UI labels rather than items
// (clan trade-type "Platinum", clan tiers, damage types, ...). Including it meant searching "Platinum"
// surfaced /Lotus/Language/Dojo/TradeTypePlatinum, which addItem can never grant.
//
// Run with: node --experimental-strip-types scripts/verify-search-index.mjs
import fs from "node:fs";
import path from "node:path";

const STEP = (() => {
    let n = 0;
    return msg => console.log(`\n[${++n}] ${msg}`);
})();
const assert = (cond, msg) => {
    if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
    console.log(`    ok - ${msg}`);
};

const script = fs.readFileSync("static/webui/script.js", "utf8");

// The currency list the picker injects, read straight out of the frontend source so the check cannot drift.
const CURRENCY_LABELS = (() => {
    const block = /const CURRENCY_LABELS = \{([\s\S]*?)\};/.exec(script);
    if (!block) throw new Error("could not locate CURRENCY_LABELS in static/webui/script.js");
    return Object.fromEntries([...block[1].matchAll(/(\w+):\s*"(\w+)"/g)].map(m => [m[1], m[2]]));
})();

STEP("CURRENCY_LABELS in the frontend covers every currency the server accepts");
const serverSource = fs.readFileSync("src/services/inventoryService.ts", "utf8");
const serverCurrencies = (() => {
    const block = /const CURRENCY_ITEM_NAMES = \[([\s\S]*?)\] as const;/.exec(serverSource);
    if (!block) throw new Error("could not locate CURRENCY_ITEM_NAMES in inventoryService.ts");
    return [...block[1].matchAll(/"(\w+)"/g)].map(m => m[1]);
})();
assert(
    serverCurrencies.length > 0,
    `parsed ${serverCurrencies.length} server currencies: ${serverCurrencies.join(", ")}`
);
for (const currency of serverCurrencies) {
    assert(currency in CURRENCY_LABELS, `${currency} is present in the frontend CURRENCY_LABELS`);
}
assert(
    Object.keys(CURRENCY_LABELS).length === serverCurrencies.length,
    "frontend and server currency lists have the same length"
);

STEP("the frontend skips AdditionalDict when building the search index");
assert(
    /type != "AdditionalDict" && Array\.isArray\(value\)/.test(script),
    "index builder filters out AdditionalDict explicitly"
);

STEP("simulate the index builder over a realistic /custom/getItemLists payload");
// Mirrors the frontend logic: flatten every array except AdditionalDict, then inject currencies.
const buildSearchIndex = data => {
    const storeItems = new Map();
    Object.entries(data)
        .filter(([type, value]) => type != "AdditionalDict" && Array.isArray(value))
        .flatMap(([, value]) => value)
        .forEach(item => {
            if (item && item.uniqueName && item.name && !storeItems.has(item.uniqueName)) {
                storeItems.set(item.uniqueName, item.name);
            }
        });
    const index = [...storeItems.entries()].map(([uniqueName, name]) => ({
        uniqueName,
        name,
        searchName: `${name.toLowerCase()} ${uniqueName.toLowerCase()}`
    }));
    for (const uniqueName of Object.keys(CURRENCY_LABELS)) {
        const name = { PremiumCredits: "白金", RegularCredits: "现金" }[uniqueName] ?? uniqueName;
        index.push({ uniqueName, name, searchName: `${name.toLowerCase()} ${uniqueName.toLowerCase()}` });
    }
    return index.sort((a, b) => a.name.localeCompare(b.name));
};

const payload = {
    Suits: [{ uniqueName: "/Lotus/Powersuits/Excalibur/Excalibur", name: "Excalibur" }],
    MiscItems: [{ uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell", name: "Orokin Cell" }],
    AdditionalDict: [
        { uniqueName: "/Lotus/Language/Dojo/TradeTypePlatinum", name: "白金" },
        { uniqueName: "/Lotus/Language/Clan/Clan_Tier3", name: "风暴" },
        { uniqueName: "/Lotus/Language/Game/DT_FIRE_NoIcon", name: "火焰" }
    ],
    blueprintAndItem: { uniqueName: "blueprintAndItem", name: "|ITEM| 蓝图" }
};
const index = buildSearchIndex(payload);

STEP("searching 白金 never surfaces the language label");
const platinumHits = index.filter(x => x.searchName.includes("白金"));
assert(
    platinumHits.some(x => x.uniqueName == "PremiumCredits"),
    "PremiumCredits is a hit for 白金"
);
assert(
    !platinumHits.some(x => x.uniqueName == "/Lotus/Language/Dojo/TradeTypePlatinum"),
    "TradeTypePlatinum is NOT a hit for 白金"
);
assert(platinumHits.length === 1, `白金 matches exactly one entry (got ${platinumHits.length})`);
console.log("    hits:", platinumHits.map(x => `${x.name} -> ${x.uniqueName}`).join(", "));

STEP("no /Lotus/Language/ entry survives anywhere in the index");
const languageEntries = index.filter(x => x.uniqueName.startsWith("/Lotus/Language/"));
assert(
    languageEntries.length === 0,
    `index contains no language labels (found ${languageEntries.length}: ${languageEntries.map(x => x.uniqueName).join(", ")})`
);

STEP("real items and currencies both remain searchable");
assert(
    index.some(x => x.uniqueName == "/Lotus/Powersuits/Excalibur/Excalibur"),
    "a warframe is still indexed"
);
assert(
    index.some(x => x.uniqueName == "/Lotus/Types/Items/MiscItems/OrokinCell"),
    "a resource is still indexed"
);
assert(
    index.filter(x => Object.keys(CURRENCY_LABELS).includes(x.uniqueName)).length ==
        Object.keys(CURRENCY_LABELS).length,
    `all ${Object.keys(CURRENCY_LABELS).length} currencies are indexed`
);

STEP("pastable field names also match, not just localised names");
// Mirrors the picker's real ranking: an exact unique-name match wins outright, then a searchName prefix,
// then any substring. Without the exact tier "fusionpoints" would surface CrewShipFusionPoints first.
const pickerMatches = (index, rawQuery) => {
    const query = rawQuery.toLowerCase();
    return index
        .filter(x => x.searchName.includes(query) || x.uniqueName.toLowerCase().includes(query))
        .sort((a, b) => {
            const rank = x => (x.uniqueName.toLowerCase() === query ? 0 : x.searchName.startsWith(query) ? 1 : 2);
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
        });
};
for (const currency of ["PremiumCredits", "RegularCredits", "FusionPoints", "PrimeTokens"]) {
    const ranked = pickerMatches(index, currency.toLowerCase());
    assert(
        ranked[0]?.uniqueName == currency,
        `typing ${currency.toLowerCase()} ranks ${currency} first (got ${ranked[0]?.uniqueName})`
    );
}

STEP("the containing-name trap is handled by the exact-match tier");
// CrewShipFusionPoints literally contains "fusionpoints", so it must not outrank FusionPoints itself.
const fusionRanked = pickerMatches(index, "fusionpoints");
assert(
    fusionRanked[0].uniqueName == "FusionPoints",
    `FusionPoints beats CrewShipFusionPoints (order: ${fusionRanked.map(x => x.uniqueName).join(" > ")})`
);
assert(
    fusionRanked.some(x => x.uniqueName == "CrewShipFusionPoints"),
    "CrewShipFusionPoints is still offered as a secondary hit"
);

STEP("addItem actually accepts the identifiers the picker offers");
// Guards against the picker advertising something the server would reject with "unable to add item".
const { addItem } = await import("../build/src/services/inventoryService.js");
const mongoose = await import("mongoose");
const { MongoMemoryServer } = await import("mongodb-memory-server-core");

const testDataDir = path.resolve("node_modules/.cache/sns-verify-db-searchindex");
fs.rmSync(testDataDir, { recursive: true, force: true });
fs.mkdirSync(testDataDir, { recursive: true });
const mongod = await MongoMemoryServer.create({
    binary: { version: "7.0.34", downloadDir: "node_modules/.cache" },
    instance: { dbPath: testDataDir, portGeneration: true }
});
await mongoose.default.connect(mongod.getUri() + "openWF");
const { Account } = await import("../build/src/models/loginModel.js");
const { Inventory } = await import("../build/src/models/inventoryModels/inventoryModel.js");
const { getInventory } = await import("../build/src/services/inventoryService.js");

const account = await Account.create({
    DisplayName: "SNS-IDX-A",
    email: "sns-idx-a@example.com",
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
const inv = await getInventory(String(account._id), undefined);

for (const currency of serverCurrencies) {
    const delta = await addItem(inv, currency, 1);
    assert(delta[currency] === 1, `addItem accepts ${currency}`);
}

let rejected = false;
try {
    await addItem(inv, "/Lotus/Language/Dojo/TradeTypePlatinum", 1);
} catch {
    rejected = true;
}
assert(rejected === true, "the language label the picker used to offer is correctly rejected");

await Inventory.deleteMany({ accountOwnerId: account._id });
await Account.deleteMany({ DisplayName: "SNS-IDX-A" });
await mongoose.default.disconnect();
await mongod.stop();

console.log("\n=== ALL CHECKS PASSED ===");
process.exit(0);
