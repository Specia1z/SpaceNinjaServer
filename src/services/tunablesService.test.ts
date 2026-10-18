import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { config } from "./configService.ts";
import {
    compileMetadataPatchesForAccount,
    getMetadataPatchesForAccount,
    getTunablesForClient
} from "./tunablesService.ts";

const previousTunables = config.tunables;
const accountId = "507f1f77bcf86cd799439011";

before(() => {
    config.tunables = {
        metadataPatches: [
            { name: "global base", targets: ["/Resource"], operations: ["Credits = 100"] },
            { name: "global second", text: "/Resource\nOther = true" }
        ],
        accountMetadataPatches: {
            [accountId]: [
                { name: "account override", text: "/Resource\nCredits = 1000" },
                { name: "account disabled", enabled: false, text: "/Resource\nIgnored = true" }
            ]
        }
    };
});

after(() => {
    config.tunables = previousTunables;
});

void test("account metadata patches are appended after global patches in array order", () => {
    assert.deepEqual(
        getMetadataPatchesForAccount(accountId).map(entry => [entry.source, entry.order, entry.patch.name]),
        [
            ["global", 0, "global base"],
            ["global", 1, "global second"],
            ["account", 2, "account override"],
            ["account", 3, "account disabled"]
        ]
    );
});

void test("compiled account output preserves override order and skips disabled patches", () => {
    assert.equal(
        compileMetadataPatchesForAccount(accountId),
        "# Server patch: global base\n/Resource\nCredits = 100\n\n# Server patch: global second\n/Resource\nOther = true\n\n# Server patch: account override\n/Resource\nCredits = 1000"
    );
    assert.equal(compileMetadataPatchesForAccount("507f1f77bcf86cd799439012").includes("account override"), false);
});

void test("compiled metadata patches are empty when no structured patches exist", () => {
    const metadataPatches = config.tunables!.metadataPatches;
    const accountMetadataPatches = config.tunables!.accountMetadataPatches;
    config.tunables!.metadataPatches = [];
    config.tunables!.accountMetadataPatches = {};
    assert.equal(compileMetadataPatchesForAccount(accountId), "");
    config.tunables!.metadataPatches = metadataPatches;
    config.tunables!.accountMetadataPatches = accountMetadataPatches;
});

void test("blacklisted accounts receive no global or account metadata patches", () => {
    config.tunables!.metadataPatchBlacklist = [accountId];
    assert.deepEqual(getMetadataPatchesForAccount(accountId), []);
    assert.equal(compileMetadataPatchesForAccount(accountId), "");
    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1", accountId).metadata_patches, undefined);
    delete config.tunables!.metadataPatchBlacklist;
});

void test("an account blacklist does not suppress global patches for other bootstrapper clients", () => {
    config.tunables!.metadataPatchBlacklist = [accountId];
    assert.equal(
        getTunablesForClient("127.0.0.1", "127.0.0.1").metadata_patches,
        "# Server patch: global base\n/Resource\nCredits = 100\n\n# Server patch: global second\n/Resource\nOther = true"
    );
    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1", accountId).metadata_patches, undefined);
    delete config.tunables!.metadataPatchBlacklist;
});

void test("native proxy forcing is only emitted when explicitly enabled", () => {
    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1").force_native_proxy, undefined);

    config.tunables!.forceNativeProxy = true;
    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1").force_native_proxy, true);
    delete config.tunables!.forceNativeProxy;
});

void test("server Pluto scripts are included in tunables with a stable revision", () => {
    const previousContent = config.tunables!.playwfContent;
    config.tunables!.playwfContent = {
        schemaVersion: 1,
        namespace: "/PlayWF",
        revision: "ignored",
        mods: [
            {
                id: "server/test",
                version: 1,
                scriptPath: "/PlayWF/test.pluto",
                script: "print('server')",
                enabled: true
            }
        ],
        accountMods: {
            [accountId]: [
                {
                    id: "account/test",
                    version: 1,
                    scriptPath: "/PlayWF/accounts/test.pluto",
                    script: "print('account')",
                    enabled: true
                }
            ]
        },
        accountBlacklist: ["blocked-account"]
    };

    try {
        const first = getTunablesForClient("127.0.0.1", "127.0.0.1");
        const second = getTunablesForClient("127.0.0.1", "127.0.0.1");
        assert.deepEqual(JSON.parse(first.playwf_scripts!), [
            { path: "/PlayWF/test.pluto", source: "print('server')" }
        ]);
        assert.equal(first.playwf_scripts_revision, second.playwf_scripts_revision);

        const accountTunables = getTunablesForClient("127.0.0.1", "127.0.0.1", accountId);
        assert.deepEqual(JSON.parse(accountTunables.playwf_scripts!), [
            { path: "/PlayWF/test.pluto", source: "print('server')" },
            { path: "/PlayWF/accounts/test.pluto", source: "print('account')" }
        ]);
        const blockedTunables = getTunablesForClient("127.0.0.1", "127.0.0.1", "blocked-account");
        assert.deepEqual(JSON.parse(blockedTunables.playwf_scripts!), []);
        assert.equal(first.playwf_scripts_update_revision, accountTunables.playwf_scripts_update_revision);
        assert.equal(first.playwf_scripts_update_revision, blockedTunables.playwf_scripts_update_revision);
        assert.equal(first.metadata_patches_update_revision, accountTunables.metadata_patches_update_revision);
        assert.equal(first.metadata_patches_update_revision, blockedTunables.metadata_patches_update_revision);
    } finally {
        config.tunables!.playwfContent = previousContent;
    }
});

void test("client buildlab must match the configured required build label", () => {
    config.tunables!.requiredBuildLabel = "2026.01.02.03.04";
    config.tunables!.versionMismatchTitle = "Version rejected";
    config.tunables!.versionMismatchMessage = "Expected |EXPECTED_BUILDLAB|, got |FOUND_BUILDLAB|";

    const allowed = getTunablesForClient("127.0.0.1", "127.0.0.1", undefined, "2026.01.02.03.04");
    assert.equal(allowed.client_version_status, "allowed");
    assert.equal(allowed.client_version_expected_buildlab, "2026.01.02.03.04");
    assert.equal(allowed.client_version_popup_message, undefined);

    const rejected = getTunablesForClient("127.0.0.1", "127.0.0.1", undefined, "2026.01.02.03.05");
    assert.equal(rejected.client_version_status, "blocked");
    assert.equal(rejected.client_version_expected_buildlab, "2026.01.02.03.04");
    assert.equal(rejected.client_version_popup_title, "Version rejected");
    assert.equal(rejected.client_version_popup_message, "Expected 2026.01.02.03.04, got 2026.01.02.03.05");

    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1").client_version_status, undefined);

    delete config.tunables!.requiredBuildLabel;
    delete config.tunables!.versionMismatchTitle;
    delete config.tunables!.versionMismatchMessage;
});
