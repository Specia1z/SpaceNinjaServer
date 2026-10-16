import assert from "node:assert/strict";
import { test } from "node:test";
import { stripExternalEventIcons } from "./worldStateClientCompatibilityService.ts";

void test("removes URL event icons that legacy clients cannot parse", () => {
    const events = [
        { Icon: "https://www-static.warframe.com/uploads/event.png" },
        { Icon: "/Lotus/Interface/Icons/WorldStatePanel/Event.png" },
        { Icon: undefined }
    ];

    stripExternalEventIcons(events);

    assert.equal(events[0].Icon, undefined);
    assert.equal(events[1].Icon, "/Lotus/Interface/Icons/WorldStatePanel/Event.png");
    assert.equal(events[2].Icon, undefined);
});
