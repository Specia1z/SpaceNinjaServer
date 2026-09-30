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
        rawMetadataPatches: "# raw global\n/RawResource\nRawValue = true",
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
        "# raw global\n/RawResource\nRawValue = true\n\n# Server patch: global base\n/Resource\nCredits = 100\n\n# Server patch: global second\n/Resource\nOther = true\n\n# Server patch: account override\n/Resource\nCredits = 1000"
    );
    assert.equal(compileMetadataPatchesForAccount("507f1f77bcf86cd799439012").includes("account override"), false);
});

void test("raw metadata patch text is preserved exactly when no structured patches exist", () => {
    const metadataPatches = config.tunables!.metadataPatches;
    const accountMetadataPatches = config.tunables!.accountMetadataPatches;
    config.tunables!.metadataPatches = [];
    config.tunables!.accountMetadataPatches = {};
    assert.equal(compileMetadataPatchesForAccount(accountId), config.tunables!.rawMetadataPatches);
    config.tunables!.metadataPatches = metadataPatches;
    config.tunables!.accountMetadataPatches = accountMetadataPatches;
});

void test("native proxy forcing is only emitted when explicitly enabled", () => {
    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1").force_native_proxy, undefined);

    config.tunables!.forceNativeProxy = true;
    assert.equal(getTunablesForClient("127.0.0.1", "127.0.0.1").force_native_proxy, true);
    delete config.tunables!.forceNativeProxy;
});
