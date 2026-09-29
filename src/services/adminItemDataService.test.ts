import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import {
    ExportCustoms,
    ExportRecipes,
    ExportRelics,
    ExportResources,
    ExportWarframes,
    ExportWeapons
} from "warframe-public-export-plus";
import { getAdminItemData, getAdminItemDataStatus, syncAdminItemData } from "./adminItemDataService.ts";

void test("administrator item data uses every JSON file from the self-contained package", async () => {
    const packageManifest = JSON.parse(
        await fs.readFile("node_modules/warframe-public-export-plus/package.json", "utf8")
    ) as { version: string };

    const status = await getAdminItemDataStatus();
    assert.equal(status.source, "self-contained warframe-public-export-plus");
    assert.equal(status.packageVersion, packageManifest.version);
    assert.ok(status.fileCount >= 58);
    assert.equal(status.counts.ExportWarframes, Object.keys(ExportWarframes).length);
    assert.equal(status.counts.ExportWeapons, Object.keys(ExportWeapons).length);
    assert.equal(status.counts.ExportResources, Object.keys(ExportResources).length);
    assert.equal(status.counts.ExportRecipes, Object.keys(ExportRecipes).length);
    assert.equal(status.counts.ExportRelics, Object.keys(ExportRelics).length);
    assert.equal(status.counts.ExportCustoms, Object.keys(ExportCustoms).length);
    assert.ok(status.counts["dict.en"] > 30_000);
    assert.ok(status.counts["supplementals/riven_unrollables"] > 300);
    assert.equal(
        status.totalEntries,
        Object.values(status.counts).reduce((total, count) => total + count, 0)
    );

    const data = await getAdminItemData("en");
    assert.equal(Object.keys(data.resources).length, Object.keys(ExportResources).length);
    assert.equal(Object.keys(data.recipes).length, Object.keys(ExportRecipes).length);
    assert.equal(Object.keys(data.relics).length, Object.keys(ExportRelics).length);
    assert.ok(Object.keys(data.dictionary ?? {}).length > 30_000);

    const refreshedStatus = await syncAdminItemData();
    assert.equal(refreshedStatus.packageVersion, packageManifest.version);
    assert.equal(refreshedStatus.fileCount, status.fileCount);
    assert.deepEqual(refreshedStatus.counts, status.counts);
});
