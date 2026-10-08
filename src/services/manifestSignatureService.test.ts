import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, test } from "node:test";

import { signManifest } from "./manifestSignatureService.ts";

const previousSigningKey = process.env.PLAYWF_MANIFEST_SIGNING_KEY_PEM;
const previousSigningKeyPath = process.env.PLAYWF_MANIFEST_SIGNING_KEY_PATH;

after(() => {
    if (previousSigningKey == undefined) delete process.env.PLAYWF_MANIFEST_SIGNING_KEY_PEM;
    else process.env.PLAYWF_MANIFEST_SIGNING_KEY_PEM = previousSigningKey;
    if (previousSigningKeyPath == undefined) delete process.env.PLAYWF_MANIFEST_SIGNING_KEY_PATH;
    else process.env.PLAYWF_MANIFEST_SIGNING_KEY_PATH = previousSigningKeyPath;
});

void test("signs canonical manifest data and rejects modified fields", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    delete process.env.PLAYWF_MANIFEST_SIGNING_KEY_PATH;
    process.env.PLAYWF_MANIFEST_SIGNING_KEY_PEM = privateKey.export({ format: "pem", type: "pkcs8" }).toString();

    const manifest = {
        schema: 1,
        tag: "test-release",
        supported_build_versions: ["2026.09.30.14.45"],
        supported_game_versions: [],
        assets: [
            {
                name: "dwmapi.dll",
                url: "/custom/launcher/assets/dwmapi.dll",
                size: 128,
                sha256: "a".repeat(64)
            }
        ]
    };
    const signed = signManifest(manifest);
    assert.equal(signed.signature.algorithm, "rsa-pss-sha256");
    const canonical = `{"assets":[{"name":"dwmapi.dll","sha256":"${"a".repeat(64)}","size":128,"url":"/custom/launcher/assets/dwmapi.dll"}],"schema":1,"supported_build_versions":["2026.09.30.14.45"],"supported_game_versions":[],"tag":"test-release"}`;
    const verify = (payload: string): boolean =>
        crypto.verify(
            "sha256",
            Buffer.from(payload),
            { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
            Buffer.from(signed.signature.signature, "base64url")
        );
    assert.equal(verify(canonical), true);
    assert.equal(verify(canonical.replace('size":128', 'size":129')), false);
});

void test("refuses to publish a manifest without a private key", () => {
    delete process.env.PLAYWF_MANIFEST_SIGNING_KEY_PATH;
    delete process.env.PLAYWF_MANIFEST_SIGNING_KEY_PEM;
    assert.throws(() => signManifest({ schema: 1, features: [] }), /not configured/);
});
