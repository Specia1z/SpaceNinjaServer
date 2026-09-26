import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { config } from "./configService.ts";
import { addMissionPlatinumReward } from "./missionPlatinumRewardService.ts";

void test("mission platinum honors chance, multiplier and inbox delivery", () => {
    const original = {
        min: config.missionPlatinumRewardMin,
        max: config.missionPlatinumRewardMax,
        chance: config.missionPlatinumRewardChance,
        sendMail: config.missionPlatinumRewardSendMail
    };
    try {
        config.missionPlatinumRewardMin = 2;
        config.missionPlatinumRewardMax = 2;
        config.missionPlatinumRewardChance = 100;
        config.missionPlatinumRewardSendMail = false;
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
    }
});
