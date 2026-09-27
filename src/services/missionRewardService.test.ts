import assert from "node:assert/strict";
import { test } from "node:test";
import type { IMissionReward as IMissionRewardExternal } from "warframe-public-export-plus";
import type { IMissionReward } from "../types/missionTypes.ts";
import {
    addFixedLevelRewards,
    getRotations,
    scaleAccountDropCount,
    scaleAccountMissionRewards,
    scaleAccountResourceItems,
    scaleReportedModItems
} from "./missionRewardService.ts";

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

void test("reported mods scale only positive quantities at final settlement", () => {
    const mods = [
        { ItemType: "/Lotus/Upgrades/Mods/Pistol/WeaponAmmoMaxMod", ItemCount: 1 },
        { ItemType: "/Lotus/Upgrades/Mods/Pistol/WeaponAmmoMaxMod", ItemCount: -1 },
        { ItemType: "/Lotus/Upgrades/Arcanes/ExampleArcane", ItemCount: 1 }
    ];
    assert.deepEqual(scaleReportedModItems(mods, 10), [
        { ItemType: mods[0].ItemType, ItemCount: 10 },
        mods[1],
        mods[2]
    ]);
    assert.deepEqual(scaleReportedModItems(mods, 1), mods);
});

void test("legacy resource fallback leaves recipes and negative counts unchanged", () => {
    const drops = [
        { ItemType: "/Lotus/Types/Items/MiscItems/Rubedo", ItemCount: 24 },
        { ItemType: "/Lotus/Types/Recipes/ExampleBlueprint", ItemCount: 2 },
        { ItemType: "/Lotus/Types/Items/MiscItems/Rubedo", ItemCount: -1 }
    ];
    assert.deepEqual(scaleAccountResourceItems(drops, 10), [
        { ItemType: drops[0].ItemType, ItemCount: 240 },
        drops[1],
        drops[2]
    ]);
});

void test("scaleAccountMissionRewards scales mission and cache rewards but not stripped items", () => {
    assert.deepEqual(
        scaleAccountMissionRewards(
            [
                { StoreItem: "/Lotus/StoreItems/Upgrades/Mods/Pistol/WeaponAmmoMaxMod", ItemCount: 1 },
                { StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/Rubedo", ItemCount: 24 },
                {
                    StoreItem: "/Lotus/StoreItems/Upgrades/Mods/Pistol/WeaponAmmoMaxMod",
                    ItemCount: 1,
                    FromEnemyCache: true
                },
                { StoreItem: "/Lotus/StoreItems/Types/Game/Projections/Example", ItemCount: 1 },
                {
                    StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/Ferrite",
                    ItemCount: 1,
                    IsStrippedItem: true
                }
            ],
            10
        ),
        [
            { StoreItem: "/Lotus/StoreItems/Upgrades/Mods/Pistol/WeaponAmmoMaxMod", ItemCount: 10 },
            { StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/Rubedo", ItemCount: 24 },
            {
                StoreItem: "/Lotus/StoreItems/Upgrades/Mods/Pistol/WeaponAmmoMaxMod",
                ItemCount: 10,
                FromEnemyCache: true
            },
            { StoreItem: "/Lotus/StoreItems/Types/Game/Projections/Example", ItemCount: 1 },
            {
                StoreItem: "/Lotus/StoreItems/Types/Items/MiscItems/Ferrite",
                ItemCount: 1,
                IsStrippedItem: true
            }
        ]
    );
});
