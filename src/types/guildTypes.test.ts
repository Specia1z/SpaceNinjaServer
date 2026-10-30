import assert from "node:assert/strict";
import { test } from "node:test";
import { guildCheatKeys, isGuildCheatKey } from "./guildTypes.ts";

void test("guild cheat validation only accepts declared cheat fields", () => {
    assert.equal(guildCheatKeys.length, 6);
    for (const key of guildCheatKeys) {
        assert.equal(isGuildCheatKey(key), true);
    }
    assert.equal(isGuildCheatKey("Name"), false);
    assert.equal(isGuildCheatKey("notARealCheat"), false);
});
