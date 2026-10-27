import assert from "node:assert/strict";
import { test } from "node:test";
import { getDescent } from "./descentService.ts";

void test("descent generation does not repeat non-repeatable challenges", () => {
    const descent = getDescent(1);
    const challenges = descent.Challenges.map(floor => floor.Challenge);

    assert.equal(new Set(challenges).size, challenges.length);
});
