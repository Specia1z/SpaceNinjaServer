import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { config } from "./configService.ts";
import { addMissionAyaReward, addMissionPlatinumReward } from "./missionPlatinumRewardService.ts";

void test("mission platinum honors chance, multiplier and inbox delivery", () => {
    const original = {
        min: config.missionPlatinumRewardMin,
        max: config.missionPlatinumRewardMax,
        chance: config.missionPlatinumRewardChance,
        sendMail: config.missionPlatinumRewardSendMail,
        dailyCap: config.missionPlatinumRewardDailyCap,
        pity: config.missionPlatinumRewardPityCompletions
    };
    try {
        config.missionPlatinumRewardMin = 2;
        config.missionPlatinumRewardMax = 2;
        config.missionPlatinumRewardChance = 100;
        config.missionPlatinumRewardSendMail = false;
        config.missionPlatinumRewardDailyCap = 100;
        config.missionPlatinumRewardPityCompletions = 0;
        const inventory = { PremiumCredits: 10 } as TInventoryDatabaseDocument;

        assert.equal(addMissionPlatinumReward(inventory, 1.5), 3);
        assert.equal(inventory.PremiumCredits, 13);

        config.missionPlatinumRewardSendMail = true;
        assert.equal(addMissionPlatinumReward(inventory, 2), 0);
        assert.equal(inventory.pendingPremiumCredits, 4);
        assert.equal(inventory.PremiumCredits, 13);

        config.missionPlatinumRewardChance = 0;
        assert.equal(addMissionPlatinumReward(inventory, 2), 0);
        assert.equal(inventory.pendingPremiumCredits, 4);
    } finally {
        config.missionPlatinumRewardMin = original.min;
        config.missionPlatinumRewardMax = original.max;
        config.missionPlatinumRewardChance = original.chance;
        config.missionPlatinumRewardSendMail = original.sendMail;
        config.missionPlatinumRewardDailyCap = original.dailyCap;
        config.missionPlatinumRewardPityCompletions = original.pity;
    }
});

void test("mission Aya uses a daily cap and pity completion", () => {
    const original = {
        min: config.missionAyaRewardMin,
        max: config.missionAyaRewardMax,
        chance: config.missionAyaRewardChance,
        dailyCap: config.missionAyaRewardDailyCap,
        pity: config.missionAyaRewardPityCompletions
    };
    try {
        config.missionAyaRewardMin = 1;
        config.missionAyaRewardMax = 1;
        config.missionAyaRewardChance = 0;
        config.missionAyaRewardDailyCap = 3;
        config.missionAyaRewardPityCompletions = 2;
        const inventory = {} as TInventoryDatabaseDocument;

        assert.equal(addMissionAyaReward(inventory), 0);
        assert.equal(inventory.missionAyaRewardPity, 1);
        inventory.missionAyaRewardDate = new Date(Date.now() - 86_400_000);
        assert.equal(addMissionAyaReward(inventory), 1);
        assert.equal(inventory.missionAyaRewardPity, 0);
        assert.equal(addMissionAyaReward(inventory), 0);
        assert.equal(inventory.missionAyaRewardPity, 1);
    } finally {
        config.missionAyaRewardMin = original.min;
        config.missionAyaRewardMax = original.max;
        config.missionAyaRewardChance = original.chance;
        config.missionAyaRewardDailyCap = original.dailyCap;
        config.missionAyaRewardPityCompletions = original.pity;
    }
});
