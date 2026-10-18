import assert from "node:assert/strict";
import { test } from "node:test";
import {
    parsePlaywfAccountScripts,
    parsePlaywfScriptBlacklist,
    parsePlaywfScripts
} from "./playwfScriptsController.ts";

void test("validates the Pluto source budget separately for each account payload", () => {
    const source = "x".repeat(1024 * 1024);
    const globalBudget = { bytes: 7 * 1024 * 1024 };
    const accountScripts = parsePlaywfAccountScripts(
        {
            first: [{ name: "first", source }],
            second: [{ name: "second", source }]
        },
        globalBudget
    );

    assert.equal(Object.keys(accountScripts).length, 2);
    assert.equal(globalBudget.bytes, 7 * 1024 * 1024);
});

void test("rejects unsafe account script IDs and duplicate script names", () => {
    assert.throws(() => parsePlaywfAccountScripts({ "../account": [] }), /safe account ID/);
    assert.throws(
        () =>
            parsePlaywfScripts([
                { name: "duplicate", source: "one" },
                { name: "duplicate", source: "two" }
            ]),
        /duplicate script name/
    );
});

void test("deduplicates account blacklist IDs", () => {
    assert.deepEqual(parsePlaywfScriptBlacklist(["first", "first", "second"]), ["first", "second"]);
});
