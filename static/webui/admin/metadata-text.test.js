import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

globalThis.metadataPatchText = undefined;
vm.runInThisContext(readFileSync("static/webui/admin/metadata-text.js", "utf8"));

test("metadata patch text parser handles continuation targets and comments", () => {
    const patches = metadataPatchText.parse("# comment\n/One &\n& /Two\nSetValue(1)\n> /Three\nClear()", key => key);
    assert.deepEqual(patches, [
        { name: "", enabled: true, targets: ["/One", "/Two"], operations: ["SetValue(1)"] },
        { name: "", enabled: true, targets: ["/Three"], operations: ["Clear()"] }
    ]);
});

test("metadata patch preview omits disabled and empty patches", () => {
    assert.equal(
        metadataPatchText.preview([
            { name: "active", enabled: true, targets: ["/A", "/B"], operations: ["Set(1)"] },
            { name: "disabled", enabled: false, targets: ["/C"], operations: ["Set(2)"] },
            { name: "empty", enabled: true, targets: [], operations: ["Set(3)"] }
        ]),
        "# Server patch: active\n/A & /B\nSet(1)"
    );
});

test("metadata patch preview preserves full text blocks and converts legacy structured patches", () => {
    assert.equal(
        metadataPatchText.preview([
            { name: "full", enabled: true, text: "# comment\n/Full\nSet(1)" },
            { name: "legacy", targets: ["/A", "/B"], operations: ["Set(2)"] }
        ]),
        "# Server patch: full\n# comment\n/Full\nSet(1)\n\n# Server patch: legacy\n/A & /B\nSet(2)"
    );
    assert.equal(metadataPatchText.toText({ targets: ["/Legacy"], operations: ["Set(3)"] }), "/Legacy\nSet(3)");
});
