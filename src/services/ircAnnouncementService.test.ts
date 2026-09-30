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
    let rejectStatus = false;
    let respondEmpty = false;
    const server = createServer((req, res) => {
        paths.push(req.url ?? "");
        if (rejectStatus) {
            res.writeHead(403).end("Forbidden");
            return;
        }
        if (respondEmpty) {
            res.writeHead(204).end();
            return;
        }
        if (!allow) res.end("This service is available via loopback only.");
        // The original IRC server broadcasts here and deliberately does not respond when allowed.
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => server.close());
    const previous = config.ircManagementUrl;
    const previousBuiltinIrcEnabled = config.builtinIrcEnabled;
    config.builtinIrcEnabled = false;
    config.ircManagementUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(() => {
        config.builtinIrcEnabled = previousBuiltinIrcEnabled;
        config.ircManagementUrl = previous;
    });

    await sendIrcAnnouncement("Trading & events?");
    assert.deepEqual(paths, ["/redtext?Trading%20%26%20events%3F"]);
    respondEmpty = true;
    await sendIrcAnnouncement("Empty response is valid");
    assert.deepEqual(paths, ["/redtext?Trading%20%26%20events%3F", "/redtext?Empty%20response%20is%20valid"]);
    respondEmpty = false;
    allow = false;
    await assert.rejects(sendIrcAnnouncement("Blocked"), /restricted to loopback/);
    rejectStatus = true;
    await assert.rejects(sendIrcAnnouncement("Forbidden"), /HTTP 403/);
    assert.deepEqual(paths, [
        "/redtext?Trading%20%26%20events%3F",
        "/redtext?Empty%20response%20is%20valid",
        "/redtext?Blocked",
        "/redtext?Forbidden"
    ]);
});
