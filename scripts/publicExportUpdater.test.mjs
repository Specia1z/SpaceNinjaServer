import assert from "node:assert/strict";
import test from "node:test";

import { compareVersions, decideUpdate, parseVersion, validateArchiveEntries } from "./publicExportUpdater.mjs";

test("parses and compares stable and prerelease versions", () => {
    assert.deepEqual(parseVersion("0.6.11"), { major: 0, minor: 6, patch: 11, prerelease: [] });
    assert.equal(compareVersions("0.6.11", "0.6.10"), 1);
    assert.equal(compareVersions("0.6.11-beta.2", "0.6.11"), -1);
});

test("only applies updates in the same compatibility series", () => {
    assert.equal(decideUpdate("0.6.10", "0.6.11", false), "available");
    assert.equal(decideUpdate("0.6.10", "0.6.11", true), "apply");
    assert.equal(decideUpdate("0.6.11", "0.7.0", true), "incompatible");
    assert.equal(decideUpdate("0.6.11", "0.6.11", true), "current");
});

test("rejects archive path traversal", () => {
    assert.doesNotThrow(() => validateArchiveEntries(["package/", "package/package.json", "package/index.mjs"]));
    assert.throws(() => validateArchiveEntries(["package/../outside"]), /Unsafe archive path/);
    assert.throws(() => validateArchiveEntries(["package//outside"]), /Unsafe archive path/);
    assert.throws(() => validateArchiveEntries(["package/./outside"]), /Unsafe archive path/);
    assert.throws(() => validateArchiveEntries(["/package/package.json"]), /Unsafe archive path/);
});
