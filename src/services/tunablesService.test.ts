import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { config } from "./configService.ts";
import { compileMetadataPatchesForAccount, getMetadataPatchesForAccount } from "./tunablesService.ts";

const previousTunables = config.tunables;
const accountId = "507f1f77bcf86cd799439011";

before(() => {
    config.tunables = {
        metadataPatches: [
            { name: "global base", targets: ["/Resource"], operations: ["Credits = 100"] },
            { name: "global second", targets: ["/Resource"], operations: ["Other = true"] }
        ],
        accountMetadataPatches: {
            [accountId]: [
                { name: "account override", targets: ["/Resource"], operations: ["Credits = 1000"] },
                { name: "account disabled", enabled: false, targets: ["/Resource"], operations: ["Ignored = true"] }
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
