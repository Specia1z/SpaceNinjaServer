import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { compareVersions, parseVersion, runUpdater } from "./publicExportUpdater.mjs";

const packageName = "warframe-public-export-plus";
const sourceManifest = JSON.parse(readFileSync(resolve("node_modules", packageName, "package.json"), "utf8"));
const sourceVersion = parseVersion(sourceManifest.version);
assert.ok(sourceVersion.patch > 0, "Integration verification needs a previous patch version");

const previousVersion = `${sourceVersion.major}.${sourceVersion.minor}.${sourceVersion.patch - 1}`;
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "sns-public-export-updater-"));
const temporaryPackage = resolve(temporaryRoot, "node_modules", packageName);
mkdirSync(temporaryPackage, { recursive: true });
writeFileSync(
    resolve(temporaryPackage, "package.json"),
    JSON.stringify({ name: packageName, version: previousVersion })
);

try {
    await runUpdater({ argv: ["--apply"], packageRoot: temporaryRoot });
    const installedManifest = JSON.parse(readFileSync(resolve(temporaryPackage, "package.json"), "utf8"));
    const installedVersion = parseVersion(installedManifest.version);
    assert.equal(installedVersion.major, sourceVersion.major);
    assert.equal(installedVersion.minor, sourceVersion.minor);
    assert.ok(compareVersions(installedManifest.version, previousVersion) > 0);
    console.log(`[public-export] Integration verification installed ${installedManifest.version} successfully.`);
} finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
}
