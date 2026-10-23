import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ExportBundles,
    ExportCustoms,
    ExportEnemies,
    ExportFusionBundles,
    ExportRecipes,
    ExportRegions,
    ExportRelics,
    ExportResources,
    ExportWarframes,
    ExportWeapons
} from "warframe-public-export-plus";
import { getItemListsController } from "./getItemListsController.ts";

interface ListedItem {
    uniqueName: string;
    name?: string;
    chainLength?: number;
}

interface ItemListPayload {
    [key: string]: ListedItem[] | string;
    Suits: ListedItem[];
    LongGuns: ListedItem[];
    Pistols: ListedItem[];
    Melee: ListedItem[];
    miscitems: ListedItem[];
    Nodes: ListedItem[];
    Bundles: ListedItem[];
    QuestKeys: ListedItem[];
}

void test("item list exposes all major categories from one self-contained snapshot", async () => {
    let payload: ItemListPayload | undefined;
    const handler = getItemListsController as unknown as (
        request: { query: Record<string, string> },
        response: { json: (value: ItemListPayload) => void }
    ) => Promise<void>;

    await handler(
        { query: { lang: "en", gameVersion: "latest" } },
        {
            json: value => {
                payload = value;
            }
        }
    );

    assert.ok(payload);
    const allItems = Object.values(payload)
        .filter((value): value is ListedItem[] => Array.isArray(value))
        .flat();
    const allNames = new Set(allItems.map(item => item.uniqueName));
    const miscNames = new Set(payload.miscitems.map(item => item.uniqueName));

    assert.ok(payload.Suits.length >= Object.keys(ExportWarframes).length - 10);
    assert.ok(
        payload.LongGuns.length + payload.Pistols.length + payload.Melee.length >= Object.keys(ExportWeapons).length / 2
    );
    assert.ok(Object.keys(ExportResources).filter(uniqueName => miscNames.has(uniqueName)).length > 2_000);
    assert.ok(Object.keys(ExportRecipes).filter(uniqueName => miscNames.has(uniqueName)).length > 1_000);
    assert.ok(Object.keys(ExportRelics).every(uniqueName => miscNames.has(uniqueName)));
    assert.ok(Object.keys(ExportCustoms).filter(uniqueName => allNames.has(uniqueName)).length > 1_000);
    assert.equal(payload.Nodes.length, Object.keys(ExportRegions).length);
    const allBundles = Object.keys(ExportBundles);
    assert.equal(payload.Bundles.length, allBundles.length);
    assert.ok(allBundles.every(uniqueName => allNames.has(uniqueName)));
    assert.ok(payload.Bundles.some(item => item.uniqueName.endsWith("AffinityBooster90DayStoreItem")));
    assert.ok(payload.Bundles.some(item => item.uniqueName.endsWith("ModDropChanceBooster90DayStoreItem")));

    const tauQuest = payload.QuestKeys.find(item => item.uniqueName.endsWith("TauPrologueKeyChainA"));
    assert.equal(tauQuest?.chainLength, 2);
});

void test("item list resolves names for every enemy drop table reward", async () => {
    let payload: ItemListPayload | undefined;
    const handler = getItemListsController as unknown as (
        request: { query: Record<string, string> },
        response: { json: (value: ItemListPayload) => void }
    ) => Promise<void>;

    await handler(
        { query: { lang: "zh", gameVersion: "latest" } },
        {
            json: value => {
                payload = value;
            }
        }
    );

    assert.ok(payload);
    const itemNames = new Map(
        Object.values(payload)
            .filter((value): value is ListedItem[] => Array.isArray(value))
            .flat()
            .map(item => [item.uniqueName, item.name ?? ""])
    );
    const rewardTypes = new Set(
        Object.values(ExportEnemies.droptables).flatMap(pools => pools.flatMap(pool => pool.items.map(item => item.type)))
    );

    assert.deepEqual([...rewardTypes].filter(type => !itemNames.has(type)), []);
    assert.deepEqual([...rewardTypes].filter(type => !itemNames.get(type) || itemNames.get(type) == type), []);
    assert.ok(Object.keys(ExportFusionBundles).every(type => itemNames.has(type)));
    assert.equal(itemNames.get("/Lotus/Upgrades/Mods/FusionBundles/CommonFusionBundle"), "内融核心 (15)");
    assert.equal(itemNames.get("/Lotus/Types/PickUps/ExcavatorCellItem"), "挖掘机能量电池");
    assert.equal(itemNames.get("/Lotus/Types/PickUps/InfestedLichChipItem"), "混音带");
    assert.equal(itemNames.get("/Lotus/RESOLUTION_FAILURE/Region Resource"), "未解析的地区资源");
});
