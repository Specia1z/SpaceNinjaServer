import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    compareVersions,
    decideUpdate,
    moveDirectory,
    parseVersion,
    validateArchiveEntries
} from "./publicExportUpdater.mjs";

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

test("copies a directory when rename fails across filesystem layers", () => {
    const root = mkdtempSync(join(tmpdir(), "public-export-updater-"));
    const source = join(root, "source");
    const destination = join(root, "backup");
    mkdirSync(source);
    writeFileSync(join(source, "package.json"), "bundled snapshot");

    const fs = {
        renameSync: () => {
            throw Object.assign(new Error("cross-device rename"), { code: "EXDEV" });
        },
        cpSync,
        rmSync
    };

    try {
        assert.equal(moveDirectory(source, destination, fs), false);
        assert.equal(readFileSync(join(destination, "package.json"), "utf8"), "bundled snapshot");
        assert.equal(existsSync(source), true);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("cleans a partial backup if the cross-device copy fails", () => {
    const root = mkdtempSync(join(tmpdir(), "public-export-updater-"));
    const source = join(root, "source");
    const destination = join(root, "backup");
    mkdirSync(source);
    writeFileSync(join(source, "package.json"), "bundled snapshot");

    const fs = {
        renameSync: () => {
            throw Object.assign(new Error("cross-device rename"), { code: "EXDEV" });
        },
        cpSync: (_source, target) => {
            mkdirSync(target);
            writeFileSync(join(target, "partial"), "partial copy");
            throw new Error("copy failed");
        },
        rmSync
    };

    try {
        assert.throws(() => moveDirectory(source, destination, fs), /copy failed/);
        assert.equal(existsSync(source), true);
        assert.equal(existsSync(destination), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
