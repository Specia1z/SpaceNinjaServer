import assert from "node:assert/strict";
import { test } from "node:test";
import { hasGuildPermissionEx } from "./guildService.ts";
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
