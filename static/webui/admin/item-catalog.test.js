import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadCatalog() {
    const calls = [];
    const context = {
        lang: "en",
        adminDataApi: {
            loadAddableItemLists: async language => {
                calls.push(language);
                return {
                    Suits: [{ uniqueName: "/Lotus/Warframes/Test", name: "Test Frame" }],
                    miscitems: [
                        { uniqueName: "/Lotus/Types/Items/TestResource", name: "Test Resource", subtype: "Resource" }
                    ],
                    AdditionalDict: [{ uniqueName: "/Lotus/Language/Labels/Rank", name: "Rank" }],
                    blueprintAndItem: "|ITEM| Blueprint"
                };
            }
        },
        loc: key => ({ currency_RegularCredits: "Credits", currency_PremiumCredits: "Platinum" })[key] ?? key,
        document: { getElementById: () => undefined }
    };
    context.window = context;
    vm.runInNewContext(readFileSync(new URL("item-catalog.js", import.meta.url), "utf8"), context, {
        filename: "item-catalog.js"
    });
    return { catalog: context.adminItemCatalog, calls };
}

test("admin item catalog loads all available lists in the requested language and includes currencies", async () => {
    const { catalog, calls } = loadCatalog();
    const items = await catalog.load("zh");

    assert.deepEqual(calls, ["zh"]);
    assert.equal(
        items.some(item => item.uniqueName === "/Lotus/Warframes/Test"),
        true
    );
    assert.equal(
        items.some(item => item.uniqueName === "/Lotus/Types/Items/TestResource"),
        true
    );
    assert.equal(
        items.some(item => item.uniqueName === "/Lotus/Language/Labels/Rank"),
        false
    );
    assert.equal(
        items.some(item => item.uniqueName === "RegularCredits"),
        true
    );
    assert.equal(
        items.some(item => item.uniqueName === "blueprintAndItem"),
        false
    );
    assert.equal(catalog.getLabel("/Lotus/Warframes/Test"), "Test Frame (/Lotus/Warframes/Test)");
});

test("admin item catalog reuses the localized 0.6.12-derived item lists until language changes", async () => {
    const { catalog, calls } = loadCatalog();
    await catalog.load("en");
    await catalog.load("en");
    await catalog.load("fr");

    assert.deepEqual(calls, ["en", "fr"]);
});
