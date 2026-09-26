import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { Request, Response } from "express";
import { Account } from "../../models/loginModel.ts";
import { config } from "../../services/configService.ts";
import { ircAnnouncementController } from "./ircAnnouncementController.ts";

void test("only administrators can send a valid global IRC announcement", async t => {
    const paths: string[] = [];
    const server = createServer((req, res) => {
        if (req.url == "/") res.end("<p>Send redtext</p>");
        else paths.push(req.url ?? "");
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => server.close());
    const previousAdmins = config.administratorNames;
    const previousUrl = config.ircManagementUrl;
    config.administratorNames = ["Admin"];
    config.ircManagementUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(() => {
        config.administratorNames = previousAdmins;
        config.ircManagementUrl = previousUrl;
    });

    let username = "Player";
    t.mock.method(Account, "findById", () => Promise.resolve({ DisplayName: username, Nonce: 123 }));

    const call = async (query: Record<string, string>, body: unknown): Promise<number> => {
        let status = 200;
        const res = {
            status(code: number) {
                status = code;
                return this;
            },
            end() {
                return this;
            },
            send() {
                return this;
            },
            json() {
                return this;
            }
        } as unknown as Response;
        await ircAnnouncementController({ query, body } as unknown as Request, res, () => {});
        return status;
    };

    assert.equal(await call({}, { message: "Hello" }), 401);
    assert.equal(await call({ accountId: "test", nonce: "123" }, { message: "Hello" }), 403);
    username = "Admin";
    assert.equal(await call({ accountId: "test", nonce: "123" }, { message: "hello\r\nmalicious" }), 400);
    assert.equal(await call({ accountId: "test", nonce: "123" }, { message: "Hello" }), 200);
    assert.deepEqual(paths, ["/redtext?Hello"]);
});
