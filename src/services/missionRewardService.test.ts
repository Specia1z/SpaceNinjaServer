import assert from "node:assert/strict";
import { test } from "node:test";
import type { IMissionReward as IMissionRewardExternal } from "warframe-public-export-plus";
import type { IMissionReward } from "../types/missionTypes.ts";
import { addFixedLevelRewards, getRotations, scaleAccountDropCount } from "./missionRewardService.ts";

void test("fixed mission rewards preserve counted items and credit bonuses", async () => {
    const rewards: IMissionReward[] = [];
    const credits = await addFixedLevelRewards(
        {
            credits: 250,
            items: ["/Lotus/StoreItems/Types/Items/MiscItems/SomeItem"],
            countedStoreItems: [{ StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/OtherItem", ItemCount: 3 }]
        } as IMissionRewardExternal,
        rewards,
        "2026.01.01.00.00"
    );
    assert.equal(credits, 250);
    assert.deepEqual(rewards, [
        { StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/SomeItem", ItemCount: 1 },
        { StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/OtherItem", ItemCount: 3 }
    ]);
});

void test("spy rotations and account drop counts retain their limits", async () => {
    assert.deepEqual(
        await getRotations({ VaultsCracked: 4 } as Parameters<typeof getRotations>[0], "2026.01.01.00.00"),
        [0, 1, 2, 2]
    );
    assert.equal(scaleAccountDropCount(3, 1.5), 4);
    assert.equal(scaleAccountDropCount(3, -1), 0);
});
