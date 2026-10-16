import assert from "node:assert/strict";
import { test } from "node:test";
import { BL_LATEST } from "../constants/gameVersions.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import {
    completeQuest,
    ensureTauPrologueQuest,
    getQuestKeyTypes,
    OLD_PEACE_QUEST,
    TAU_PROLOGUE_QUEST,
    THE_HEX_QUEST,
    updateQuestKey
} from "./questService.ts";

const ARCHWING_QUEST = "/Lotus/Types/Keys/ArchwingQuest/ArchwingQuestKeyChain";

void test("ensureTauPrologueQuest requires both prerequisite quests", () => {
    const inventory = new Inventory({
        QuestKeys: [{ ItemType: THE_HEX_QUEST, Completed: true }]
    });

    assert.equal(ensureTauPrologueQuest(inventory), undefined);
    assert.equal(
        inventory.QuestKeys.some(quest => quest.ItemType === TAU_PROLOGUE_QUEST),
        false
    );
});

void test("ensureTauPrologueQuest grants the first Tau keychain once", () => {
    const inventory = new Inventory({
        QuestKeys: [
            { ItemType: THE_HEX_QUEST, Completed: true },
            { ItemType: OLD_PEACE_QUEST, Completed: true }
        ]
    });

    const grantedQuest = ensureTauPrologueQuest(inventory);
    assert.equal(grantedQuest?.ItemType, TAU_PROLOGUE_QUEST);
    assert.equal(inventory.QuestKeys.filter(quest => quest.ItemType === TAU_PROLOGUE_QUEST).length, 1);
    assert.equal(ensureTauPrologueQuest(inventory), undefined);
    assert.equal(inventory.QuestKeys.filter(quest => quest.ItemType === TAU_PROLOGUE_QUEST).length, 1);
});

void test("getQuestKeyTypes includes supplemental quest chains only when requested", () => {
    const officialQuestKeys = getQuestKeyTypes();
    const allQuestKeys = getQuestKeyTypes(true);

    assert.equal(officialQuestKeys.includes(TAU_PROLOGUE_QUEST), false);
    assert.equal(allQuestKeys.includes(TAU_PROLOGUE_QUEST), true);
    assert.equal(allQuestKeys.filter(questKey => questKey.includes("/Lotus/Types/Keys/TauPrologue/")).length, 3);
});

void test("completeQuest completes the supplemental Tau A stages", async () => {
    const inventory = new Inventory({
        QuestKeys: [{ ItemType: TAU_PROLOGUE_QUEST }]
    });

    await completeQuest(inventory, TAU_PROLOGUE_QUEST, BL_LATEST);

    const questKey = inventory.QuestKeys.find(quest => quest.ItemType === TAU_PROLOGUE_QUEST);
    assert.ok(questKey);
    assert.equal(questKey.Completed, true);
    assert.ok(questKey.Progress);
    assert.equal(questKey.Progress.length, 2);
});

void test("completing the second prerequisite reports the Tau keychain in inventory changes", async () => {
    const inventory = new Inventory({
        QuestKeys: [
            { ItemType: THE_HEX_QUEST, Completed: false },
            { ItemType: OLD_PEACE_QUEST, Completed: true }
        ]
    });

    const inventoryChanges = await updateQuestKey(inventory, [{ ItemType: THE_HEX_QUEST, Completed: true }]);

    assert.equal(inventoryChanges.QuestKeys?.[0]?.ItemType, TAU_PROLOGUE_QUEST);
});

void test("completeQuest grants Archwing stage equipment for a missing quest key", async () => {
    const inventory = new Inventory({ RegularCredits: 0 });

    await completeQuest(inventory, ARCHWING_QUEST, BL_LATEST);

    const questKey = inventory.QuestKeys.find(quest => quest.ItemType == ARCHWING_QUEST);
    assert.equal(questKey?.Completed, true);
    assert.equal(inventory.ArchwingEnabled, true);
    assert.ok(
        inventory.SpaceSuits.some(item => item.ItemType == "/Lotus/Powersuits/Archwing/StandardJetPack/StandardJetPack")
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
