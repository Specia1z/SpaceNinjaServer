import assert from "node:assert/strict";
import { test } from "node:test";
import { getExportKeys } from "./publicExportService.ts";

void test("getExportKeys exposes the Tau Prologue chapters to the client", () => {
    const keys = getExportKeys("en").ExportKeys;
    const tauKeys = keys.filter(key => key.uniqueName.includes("/Lotus/Types/Keys/TauPrologue/"));

    assert.deepEqual(
        tauKeys.map(key => key.uniqueName),
        [
            "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainA",
            "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainB",
            "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainC"
        ]
    );
    assert.equal(tauKeys[0]?.name, "Lua");
    assert.equal(
        tauKeys[0]?.description,
        "Find the Lotus in the Dark Refractory and seek her out within her memories."
    );

    const fallbackKey = getExportKeys("zh").ExportKeys.find(
        key => key.uniqueName === "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainA"
    );
    assert.ok(fallbackKey);
    assert.equal(fallbackKey.name, "Lua");
    assert.equal(
        fallbackKey.description,
        "Find the Lotus in the Dark Refractory and seek her out within her memories."
    );
});
