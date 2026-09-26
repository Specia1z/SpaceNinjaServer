import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

void test("shared currency forms retain inventory and clan balance behavior", async () => {
    const requests = [];
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, { valueAsNumber: 10, textContent: "" });
        return elements.get(id);
    };
    const context = {
        authz: "auth=token",
        guildId: "clan",
        inventory_data: { RegularCredits: 1 },
        document: { getElementById: get },
        revalidateAuthz: () => Promise.resolve(),
        loc: key => (key === "guildView_currency_owned" ? "Clan: |COUNT|" : "Owned: |COUNT|"),
        $: {
            post(options) {
                requests.push(options);
                return Promise.resolve(requests.length === 1 ? 25 : 75);
            }
        }
    };
    context.window = context;
    for (const file of ["api.js", "page.js"]) {
        vm.runInNewContext(readFileSync(new URL(file, import.meta.url), "utf8"), context, { filename: file });
    }
    context.doAddCurrency("RegularCredits");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests[0].url, "/custom/addCurrency?auth=token&guildId=clan");
    assert.deepEqual(JSON.parse(requests[0].data), { currency: "RegularCredits", delta: 10 });
    assert.equal(context.inventory_data.RegularCredits, 25);
    assert.equal(get("RegularCredits-owned").textContent, "Owned: 25");
    context.doAddCurrency("VaultRegularCredits");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(JSON.parse(requests[1].data), { currency: "VaultRegularCredits", delta: 10 });
    assert.equal(get("VaultRegularCredits-owned").textContent, "Clan: 75");
    assert.equal(context.inventory_data.RegularCredits, 25);
});
