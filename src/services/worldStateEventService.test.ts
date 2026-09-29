import assert from "node:assert/strict";
import { test } from "node:test";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { localizeWorldStateEvents } from "./worldStateEventService.ts";

void test("localized world-state events omit blank cards and map localized links to Prop", () => {
    const events: IWorldState["Events"] = [
        {
            Messages: [{ LanguageCode: "ja", Message: "Japanese only" }],
            Prop: "https://example.com/ja"
        },
        {
            Messages: [
                { LanguageCode: "en", Message: "English" },
                { LanguageCode: "zh", Message: "Chinese" }
            ],
            Links: [
                { LanguageCode: "en", Link: "https://example.com/en" },
                { LanguageCode: "zh", Link: "https://example.com/zh" }
            ]
        },
        {
            Messages: [{ LanguageCode: "en", Message: "English fallback" }],
            Links: [{ LanguageCode: "en", Link: "https://example.com/fallback" }]
        },
        {
            Msg: "Legacy message",
            Messages: [],
            Prop: "https://example.com/legacy"
        }
    ];

    assert.deepEqual(localizeWorldStateEvents(events, "zh"), [
        {
            Messages: [{ Message: "Chinese" }],
            Prop: "https://example.com/zh"
        },
        {
            Messages: [{ Message: "English fallback" }],
            Prop: "https://example.com/fallback"
        },
        {
            Msg: "Legacy message",
            Messages: [{ Message: "Legacy message" }],
            Prop: "https://example.com/legacy"
        }
    ]);
});
