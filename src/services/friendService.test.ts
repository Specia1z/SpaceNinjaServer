import assert from "node:assert/strict";
import { test } from "node:test";
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";
import { shouldIncludeLastPlatform } from "./friendService.ts";

void test("LastPlatform remains available before U44", () => {
    assert.equal(shouldIncludeLastPlatform("2026.09.22.16.45"), true);
});

void test("LastPlatform is omitted for U44 and newer clients", () => {
    assert.equal(shouldIncludeLastPlatform(gameToBuildVersion["44.0.0"]), false);
    assert.equal(shouldIncludeLastPlatform("2026.09.28.00.00"), false);
});
