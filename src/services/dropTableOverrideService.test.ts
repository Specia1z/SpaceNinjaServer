import assert from "node:assert/strict";
import { test } from "node:test";
import { ExportEnemies } from "warframe-public-export-plus";
import {
    getDropTableDetail,
    getEffectiveEnemyDropTable,
    getMiscDropTablePool,
    isDropItemPath,
    isDropTablePath,
    listDropTablePage,
    normalizeDropTableOverride
} from "./dropTableOverrideService.ts";

const droneDropTable = "/Lotus/Types/DropTables/CorpusEliteShieldDroneAgentDropTable";
const droneAvatar = "/Lotus/Types/Enemies/Corpus/Drones/AIWeek/CorpusEliteShieldDroneAvatar";
const teralystDropTable = "/Lotus/Types/DropTables/EidolonDropTables/TeralystDefaultDropTable";

void test("drop table catalog exposes stock enemy references and pools", () => {
    const page = listDropTablePage(1, 100, "CorpusEliteShieldDrone");
    const table = page.items.find(item => item.DropTable == droneDropTable);

    assert.ok(table);
    assert.equal(table.HasDefault, true);
    assert.equal(table.HasOverride, false);
    assert.ok(table.Enemies.some(enemy => enemy.uniqueName == droneAvatar));
    assert.equal(
        table.Enemies.some(enemy => enemy.isBoss),
        false
    );

    const detail = getDropTableDetail(droneDropTable);
    assert.equal(detail.DefaultPools.find(pool => pool.type == "resource")?.chance, 0.06);
    assert.equal(detail.Override, undefined);
});

void test("drop table overrides validate paths, pool types, and item weights", () => {
    assert.equal(isDropTablePath(droneDropTable), true);
    assert.equal(isDropTablePath("/Lotus/Types/DropTables/"), false);
    assert.equal(isDropItemPath("/Lotus/Types/Items/MiscItems/Elitium"), true);
    assert.equal(isDropItemPath("/Items/Elitium"), false);

    const normalized = normalizeDropTableOverride({
        DropTable: droneDropTable,
        Pools: [
            {
                type: "resource",
                chance: 1,
                items: [{ type: "/Lotus/Types/Items/MiscItems/Elitium", probability: 1 }]
            }
        ],
        UpdatedBy: "test"
    });
    assert.deepEqual(normalized, {
        DropTable: droneDropTable,
        Enabled: true,
        Pools: [
            {
                type: "resource",
                chance: 1,
                items: [{ type: "/Lotus/Types/Items/MiscItems/Elitium", probability: 1 }]
            }
        ],
        UpdatedBy: "test"
    });

    assert.throws(
        () =>
            normalizeDropTableOverride({
                DropTable: droneDropTable,
                Pools: [
                    {
                        type: "resource",
                        chance: 1,
                        items: [{ type: "/Lotus/Types/Items/MiscItems/Elitium", probability: 0 }]
                    }
                ],
                UpdatedBy: "test"
            }),
        /positive item probability/
    );
    assert.throws(
        () =>
            normalizeDropTableOverride({
                DropTable: droneDropTable,
                Pools: [
                    {
                        type: "resource",
                        chance: 1,
                        items: [{ type: "/Lotus/Types/Items/MiscItems/Elitium", probability: 1 }]
                    },
                    {
                        type: "resource",
                        chance: 1,
                        items: [{ type: "/Lotus/Types/Items/MiscItems/Elitium", probability: 1 }]
                    }
                ],
                UpdatedBy: "test"
            }),
        /Duplicate drop table pool type/
    );
});

void test("effective stock tables remain unchanged when no override is loaded", () => {
    assert.deepEqual(getEffectiveEnemyDropTable(droneDropTable), ExportEnemies.droptables[droneDropTable]);
    assert.equal(getMiscDropTablePool(ExportEnemies.droptables[teralystDropTable] ?? [])?.type, "sigil");
});
