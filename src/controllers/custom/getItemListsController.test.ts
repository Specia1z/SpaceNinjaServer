import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ExportBundles,
    ExportCustoms,
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
    const marketBundles = Object.entries(ExportBundles)
        .filter(([, bundle]) => !bundle.excludeFromMarket)
        .map(([uniqueName]) => uniqueName);
    assert.equal(payload.Bundles.length, marketBundles.length);
    assert.ok(marketBundles.every(uniqueName => allNames.has(uniqueName)));
});
