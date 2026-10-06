import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readFeaturePackageManifest, resolveFeaturePackage, verifyFeaturePackage } from "./featurePackageService.ts";

void test("feature manifest starts empty and rejects an unavailable package", () => {
    const manifest = readFeaturePackageManifest();
    assert.equal(manifest.schema, 1);
    assert.ok(Array.isArray(manifest.features));
    assert.equal(resolveFeaturePackage("missing", "1.0.0"), undefined);
});

void test("feature package metadata uses the declared SHA-256", () => {
    const packagePath = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "playwf-feature-test-")),
        "test-fixture.pwfpkg"
    );
    const data = Buffer.from("PWF1\x01\x00\x00\x00\x00\x00\x00\x00", "binary");
    const digest = crypto.createHash("sha256").update(data).digest("hex");
    fs.writeFileSync(packagePath, data);
    try {
        assert.equal(
            verifyFeaturePackage(
                { id: "fixture", version: "1.0.0", file: "test-fixture.pwfpkg", size: data.length, sha256: digest },
                packagePath
            ),
            true
        );
    } finally {
        fs.rmSync(path.dirname(packagePath), { force: true, recursive: true });
    }
});
