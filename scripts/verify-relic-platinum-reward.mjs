// Verifies global relic platinum values and final reward-selection adjustments.
// Run after building with: node scripts/verify-relic-platinum-reward.mjs
const assert = (condition, message) => {
    if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
    console.log(`ok - ${message}`);
};

const { config } = await import("../build/src/services/configService.js");
const { adjustPendingRelicPlatinum, getRelicPlatinumRewardForRarity } =
    await import("../build/src/helpers/relicHelper.js");

config.relicPlatinumReward = { common: 1, uncommon: 3, rare: 8 };

assert(getRelicPlatinumRewardForRarity("COMMON") === 1, "common reward uses the global value");
assert(getRelicPlatinumRewardForRarity("UNCOMMON") === 3, "uncommon reward uses the global value");
assert(getRelicPlatinumRewardForRarity("RARE") === 8, "rare reward uses the global value");
assert(getRelicPlatinumRewardForRarity("LEGENDARY") === 0, "unsupported rarities award no platinum");

const inventory = {};
adjustPendingRelicPlatinum(inventory, undefined, "RARE");
assert(inventory.pendingPremiumCredits === 8, "initial rare roll queues 8 platinum");

adjustPendingRelicPlatinum(inventory, "RARE", "COMMON");
assert(inventory.pendingPremiumCredits === 1, "selecting a common reward removes the rare-to-common difference");

adjustPendingRelicPlatinum(inventory, "COMMON", "UNCOMMON");
assert(inventory.pendingPremiumCredits === 3, "selecting an uncommon reward applies only the difference");

adjustPendingRelicPlatinum(inventory, "UNCOMMON", "UNCOMMON");
assert(inventory.pendingPremiumCredits === 3, "repeating finalization does not award platinum twice");

config.relicPlatinumReward = { common: -4, uncommon: 3.9, rare: 0 };
assert(getRelicPlatinumRewardForRarity("COMMON") === 0, "negative runtime values are clamped to zero");
assert(getRelicPlatinumRewardForRarity("UNCOMMON") === 3, "fractional runtime values are truncated");

console.log("ALL RELIC PLATINUM CHECKS PASSED");
