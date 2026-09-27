import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { Request, Response } from "express";
import WebSocket from "ws";
import { loginController } from "../controllers/api/loginController.ts";
import { Account } from "../models/loginModel.ts";
import { config } from "./configService.ts";
import { reserveRegistration } from "./registrationRateLimitService.ts";
import { startWsServer, stopWsServers } from "./wsService.ts";

void test("game and WebUI reject registration at the same address quota", async t => {
    const previousPolicy = config.registrationRateLimit;
    const previousAutoCreate = config.autoCreateAccount;
    config.autoCreateAccount = true;
    config.registrationRateLimit = { perAddress: 1, global: 10, windowMinutes: 60 };
    t.after(() => {
        config.registrationRateLimit = previousPolicy;
        config.autoCreateAccount = previousAutoCreate;
    });
    assert.equal(reserveRegistration("127.0.0.1").allowed, true);
    const lookup = t.mock.method(Account, "findOne", () => Promise.resolve(null));
    const save = t.mock.method(Account.prototype as { save: () => Promise<unknown> }, "save", () =>
        Promise.reject(new Error("unexpected account save"))
    );

    let status = 200;
    let body: unknown;
    const res = {
        set() {
            return this;
        },
        status(code: number) {
            status = code;
            return this;
        },
        json(data: unknown) {
            body = data;
            return this;
        }
    } as unknown as Response;
    await loginController(
        {
            body: Buffer.from(JSON.stringify({ email: "game-new@example.com", password: "secret" })),
            query: { buildLabel: "2013.01.04.10.41/" },
            headers: {},
            socket: { remoteAddress: "127.0.0.1" }
        } as unknown as Request,
        res,
        () => {}
    );
    assert.equal(status, 429);
    assert.deepEqual(body, { error: "registration rate limit exceeded" });

    const server = createServer();
    startWsServer(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const ws = new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}`);
    t.after(async () => {
        ws.terminate();
        const pending: Promise<void>[] = [];
        stopWsServers(pending);
        await Promise.all(pending);
        await new Promise<void>(resolve => server.close(() => resolve()));
    });
    await once(ws, "open");
    const failure = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("No registration response")), 3000);
        ws.on("message", raw => {
            const message = JSON.parse(String(raw)) as { auth_fail?: string };
            if (message.auth_fail) {
                clearTimeout(timeout);
                resolve(message.auth_fail);
            }
        });
        ws.send(
            JSON.stringify({
                auth: { email: "web-new@example.com", password: "secret", isRegister: true, allPermissions: [] }
            })
        );
    });
    assert.equal(failure, "rate limited");
    assert.equal(lookup.mock.calls.length, 2);
    assert.equal(save.mock.calls.length, 0);
});
