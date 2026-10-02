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

void test("expired global credit boosts are ignored at settlement", async () => {
    const previousWorldState = config.worldState;
    config.worldState = {
        ...previousWorldState,
        creditBoostMultiplier: 2,
        boostExpiresAt: "2000-01-01T00:00:00.000Z"
    };
    try {
        const today = Math.trunc(Date.now() / 86400000) * 86400;
        const account = {
            DailyFirstWinDate: today,
            save: (): Promise<void> => Promise.resolve()
        } as unknown as TAccountDocument;
        const inventory = { RegularCredits: 0, Boosters: [] } as unknown as TInventoryDatabaseDocument;
        const result = await addMissionCredits(
            account,
            inventory,
            { missionDropCredits: 10, missionCompletionCredits: 20, rngRewardCredits: 5 },
            1
        );
        assert.deepEqual(result.TotalCredits, [35, 35]);
        assert.equal(inventory.RegularCredits, 0);
    } finally {
        config.worldState = previousWorldState;
    }
});

void test("account rate compounds with an active inventory Credit Booster", async () => {
    const today = Math.trunc(Date.now() / 86400000) * 86400;
    const account = {
        DailyFirstWinDate: today,
        save: (): Promise<void> => Promise.resolve()
    } as unknown as TAccountDocument;
    const inventory = {
        // Base mission sources have already been booked before addMissionCredits adds multiplier differences.
        RegularCredits: 135,
        Boosters: [
            {
                ItemType: "/Lotus/Types/Boosters/CreditBooster",
                ExpiryDate: Math.trunc(Date.now() / 1000) + 60
            }
        ]
    } as unknown as TInventoryDatabaseDocument;

    const result = await addMissionCredits(
        account,
        inventory,
        { missionDropCredits: 10, missionCompletionCredits: 20, rngRewardCredits: 5 },
        3
    );

    assert.deepEqual(result.TotalCredits, [35, 210]);
    assert.equal(inventory.RegularCredits, 310);
});

void test("modern client cash pickups are not account-boosted again at settlement", async () => {
    const today = Math.trunc(Date.now() / 86400000) * 86400;
    const account = {
        DailyFirstWinDate: today,
        save: (): Promise<void> => Promise.resolve()
    } as unknown as TAccountDocument;
    const inventory = {
        // The client has already turned a 10-credit pickup into 30; server rewards remain unboosted.
        RegularCredits: 155,
        Boosters: [
            {
                ItemType: "/Lotus/Types/Boosters/CreditBooster",
                ExpiryDate: Math.trunc(Date.now() / 1000) + 60
            }
        ]
    } as unknown as TInventoryDatabaseDocument;

    const result = await addMissionCredits(
        account,
        inventory,
        { missionDropCredits: 30, missionCompletionCredits: 20, rngRewardCredits: 5 },
        3,
        true
    );

    assert.deepEqual(result.TotalCredits, [55, 210]);
    assert.equal(inventory.RegularCredits, 310);
});
