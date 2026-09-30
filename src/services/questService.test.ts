import assert from "node:assert/strict";
import { test } from "node:test";
import { BL_LATEST } from "../constants/gameVersions.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { completeQuest } from "./questService.ts";

const ARCHWING_QUEST = "/Lotus/Types/Keys/ArchwingQuest/ArchwingQuestKeyChain";

void test("completeQuest grants Archwing stage equipment for a missing quest key", async () => {
    const inventory = new Inventory({ RegularCredits: 0 });

    await completeQuest(inventory, ARCHWING_QUEST, BL_LATEST);

    const questKey = inventory.QuestKeys.find(quest => quest.ItemType == ARCHWING_QUEST);
    assert.equal(questKey?.Completed, true);
    assert.equal(inventory.ArchwingEnabled, true);
    assert.ok(
        inventory.SpaceSuits.some(
            item => item.ItemType == "/Lotus/Powersuits/Archwing/StandardJetPack/StandardJetPack"
        )
    );
    assert.ok(
        inventory.SpaceGuns.some(
            item => item.ItemType == "/Lotus/Weapons/Tenno/Archwing/Primary/FoldingMachineGun/ArchMachineGun"
        )
    );
    assert.ok(
        inventory.SpaceMelee.some(
            item => item.ItemType == "/Lotus/Weapons/Tenno/Archwing/Melee/Archsword/ArchSwordWeapon"
        )
    );
});

void test("completeQuest repairs missing equipment for an already completed Archwing quest", async () => {
    const inventory = new Inventory({
        RegularCredits: 0,
        QuestKeys: [{ ItemType: ARCHWING_QUEST, Completed: true, Progress: [] }]
    });

    await completeQuest(inventory, ARCHWING_QUEST, BL_LATEST);
    await completeQuest(inventory, ARCHWING_QUEST, BL_LATEST);

    assert.equal(inventory.ArchwingEnabled, true);
    assert.equal(
        inventory.SpaceSuits.filter(
            item => item.ItemType == "/Lotus/Powersuits/Archwing/StandardJetPack/StandardJetPack"
        ).length,
        1
    );
    assert.equal(
        inventory.SpaceGuns.filter(
            item => item.ItemType == "/Lotus/Weapons/Tenno/Archwing/Primary/FoldingMachineGun/ArchMachineGun"
        ).length,
        1
    );
    assert.equal(
        inventory.SpaceMelee.filter(
            item => item.ItemType == "/Lotus/Weapons/Tenno/Archwing/Melee/Archsword/ArchSwordWeapon"
        ).length,
        1
    );
});
