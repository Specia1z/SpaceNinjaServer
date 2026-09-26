import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { config } from "./configService.ts";
import type { TAccountDocument } from "./loginService.ts";
import { addMissionCredits } from "./missionCreditService.ts";

void test("account rate scales the daily first win and global credit reward", async () => {
    const previousWorldState = config.worldState;
    config.worldState = { ...previousWorldState, creditBoostMultiplier: 2 };
    try {
        let saved = false;
        const account = {
            DailyFirstWinDate: 0,
            save: (): Promise<void> => {
                saved = true;
                return Promise.resolve();
            }
        } as unknown as TAccountDocument;
        const inventory = { RegularCredits: 110, Boosters: [] } as unknown as TInventoryDatabaseDocument;
        const result = await addMissionCredits(
            account,
            inventory,
            { missionDropCredits: 10, missionCompletionCredits: 10, rngRewardCredits: 5 },
            1.5
        );
        assert.equal(saved, true);
        assert.equal(result.DailyMissionBonus, true);
        assert.deepEqual(result.TotalCredits, [35, 105]);
        assert.equal(inventory.RegularCredits, 190);
    } finally {
        config.worldState = previousWorldState;
    }
});
