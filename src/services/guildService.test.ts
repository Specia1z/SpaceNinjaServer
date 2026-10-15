import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import { handleGuildGoalProgress, hasGuildPermissionEx } from "./guildService.ts";
import type { TGuildDatabaseDocument } from "../models/guildModel.ts";
import type { IGuildMemberDatabase } from "../types/guildTypes.ts";
import { eGuildPermission } from "../types/guildTypes.ts";

const guild = {
    Ranks: [{ Permissions: eGuildPermission.Recruiter }]
} as unknown as TGuildDatabaseDocument;

void test("founding warlords retain guild invite permission", () => {
    assert.equal(hasGuildPermissionEx(guild, { rank: 0 } as IGuildMemberDatabase, eGuildPermission.Recruiter), true);
});

void test("invalid guild ranks fail permission checks without throwing", () => {
    assert.equal(hasGuildPermissionEx(guild, { rank: 99 } as IGuildMemberDatabase, eGuildPermission.Recruiter), false);
});

void test("Road to Tau guild goals award each clan trophy at its threshold", async () => {
    const goalId = new Types.ObjectId();
    const roadToTauGuild = {
        Tier: 1,
        save: async () => {}
    } as unknown as TGuildDatabaseDocument;

    await handleGuildGoalProgress(roadToTauGuild, { Count: 1500, Tag: "RoadToTauEvent", goalId });
    await handleGuildGoalProgress(roadToTauGuild, { Count: 3000, Tag: "RoadToTauEvent", goalId });
    await handleGuildGoalProgress(roadToTauGuild, { Count: 1500, Tag: "RoadToTauEvent", goalId });

    assert.deepEqual(roadToTauGuild.GoalProgress?.[0].Count, 6000);
    assert.deepEqual(roadToTauGuild.VaultDecoRecipes, [
        {
            ItemType: "/Lotus/Levels/ClanDojo/ComponentPropRecipes/RoadToTauEventTerracottaTrophyRecipe",
            ItemCount: 1
        },
        {
            ItemType: "/Lotus/Levels/ClanDojo/ComponentPropRecipes/RoadToTauEventBronzeTrophyRecipe",
            ItemCount: 1
        },
        {
            ItemType: "/Lotus/Levels/ClanDojo/ComponentPropRecipes/RoadToTauEventSilverTrophyRecipe",
            ItemCount: 1
        },
        {
            ItemType: "/Lotus/Levels/ClanDojo/ComponentPropRecipes/RoadToTauEventGoldTrophyRecipe",
            ItemCount: 1
        }
    ]);
});

void test("unknown guild goal tags save progress without throwing", async () => {
    const guild = {
        Tier: 1,
        save: async () => {}
    } as unknown as TGuildDatabaseDocument;

    await handleGuildGoalProgress(guild, {
        Count: 10,
        Tag: "UnknownGuildGoal",
        goalId: new Types.ObjectId()
    });

    assert.equal(guild.GoalProgress?.[0].Count, 10);
    assert.equal(guild.VaultDecoRecipes, undefined);
});
