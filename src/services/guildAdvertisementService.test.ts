import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import type { IGuildAdDatabase } from "../types/guildTypes.ts";
import {
    buildGuildAdSearchQuery,
    guildAdMatchesFeatures,
    normalizeGuildAdLanguages,
    parseGuildAdSearchOptions,
    toGuildAdInfoClient
} from "./guildAdvertisementService.ts";

void test("guild advertisement languages are normalized and deduplicated", () => {
    assert.deepEqual(normalizeGuildAdLanguages([" EN ", "zh-CN,EN", "bad!", 3]), ["en", "zh-cn"]);
});

void test("guild advertisement search options parse supported filters safely", () => {
    assert.deepEqual(
        parseGuildAdSearchOptions({
            tier: "3",
            name: "  Lotus.*  ",
            language: ["EN", "zh-CN"],
            features: "5",
            minMembers: "10",
            maxMembers: "100",
            limit: "900"
        }),
        {
            tier: 3,
            name: "Lotus.*",
            languages: ["en", "zh-cn"],
            features: 5,
            minMembers: 10,
            maxMembers: 100,
            limit: 500
        }
    );
});

void test("guild advertisement search query filters active matching advertisements", () => {
    const now = new Date("2026-09-29T00:00:00.000Z");
    const query = buildGuildAdSearchQuery(
        { tier: 2, name: "Lotus.*", languages: ["en"], minMembers: 5, maxMembers: 50 },
        now
    );
    assert.deepEqual(query.Expiry, { $gt: now });
    assert.equal(query.Tier, 2);
    assert.equal((query.GuildName as RegExp).source, "Lotus\\.\\*");
    assert.deepEqual(query.Languages, { $in: ["en"] });
    assert.deepEqual(query.MemberCount, { $gte: 5, $lte: 50 });
});

void test("guild advertisement feature matching requires every selected bit", () => {
    assert.equal(guildAdMatchesFeatures({ Features: 0b1110 }, 0b0110), true);
    assert.equal(guildAdMatchesFeatures({ Features: 0b1010 }, 0b0110), false);
    assert.equal(guildAdMatchesFeatures({ Features: 0b1010 }), true);
});

void test("guild advertisement response preserves searchable metadata", () => {
    const guildId = new Types.ObjectId();
    const expiry = new Date("2026-09-30T00:00:00.000Z");
    const ad: IGuildAdDatabase = {
        GuildId: guildId,
        Expiry: expiry,
        Features: 7,
        GuildName: "Lotus Search",
        Languages: ["en", "zh-cn"],
        MemberCount: 42,
        RecruitMsg: "Recruiting",
        Tier: 3
    };
    const response = toGuildAdInfoClient(ad);
    assert.equal(response._id.$oid, guildId.toString());
    assert.deepEqual(response.Languages, ["en", "zh-cn"]);
    assert.equal(response.MemberCount, 42);
    assert.equal(response.GuildName, "Lotus Search");
});
