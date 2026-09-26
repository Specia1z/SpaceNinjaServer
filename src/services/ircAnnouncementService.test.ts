import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { config } from "./configService.ts";
import { isValidIrcAnnouncement, sendIrcAnnouncement } from "./ircAnnouncementService.ts";

void test("IRC announcements reject empty, multiline, control, and oversized messages", () => {
    assert.equal(isValidIrcAnnouncement("Hello world"), true);
    assert.equal(isValidIrcAnnouncement("公告".repeat(66)), true);
    for (const invalid of ["", "  ", "line\r\nINJECT", "colour\u0003code", "X".repeat(401), "公告".repeat(67), 42]) {
        assert.equal(isValidIrcAnnouncement(invalid), false);
    }
});

void test("IRC relay submits URL-encoded redtext without a server reply", async t => {
    const paths: string[] = [];
    let allow = true;
    const server = createServer((req, res) => {
        if (req.url == "/") {
            res.end(allow ? "<p>Send redtext</p>" : "This service is available via loopback only.");
        } else {
            paths.push(req.url ?? "");
            // The original IRC server broadcasts here and deliberately does not respond.
        }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => server.close());
    const previous = config.ircManagementUrl;
    config.ircManagementUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(() => {
        config.ircManagementUrl = previous;
    });

    await sendIrcAnnouncement("Trading & events?");
    assert.deepEqual(paths, ["/redtext?Trading%20%26%20events%3F"]);
    allow = false;
    await assert.rejects(sendIrcAnnouncement("Blocked"), /unavailable/);
    assert.equal(paths.length, 1);
});
