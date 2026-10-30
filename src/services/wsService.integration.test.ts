import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Account } from "../models/loginModel.ts";
import { config } from "./configService.ts";
import { startWsServer, stopWsServers } from "./wsService.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}ws-service-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

const waitForMessage = <T extends Record<string, unknown>>(
    ws: WebSocket,
    predicate: (message: T) => boolean
): Promise<T> =>
    new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.off("message", onMessage);
            reject(new Error("Timed out waiting for WebSocket message"));
        }, 3000);
        const onMessage = (raw: WebSocket.RawData): void => {
            const message = JSON.parse(String(raw)) as T;
            if (!predicate(message)) return;
            clearTimeout(timeout);
            ws.off("message", onMessage);
            resolve(message);
        };
        ws.on("message", onMessage);
    });

void test("permission refresh keeps the real administrator when possessing another account", async t => {
    const previousAdmins = config.administratorNames;
    const previousWebui = config.webui;
    const admin = await new Account({
        email: "ws-admin@example.com",
        password: "secret",
        DisplayName: "WsAdmin",
        Nonce: 1001,
        ClientType: "webui",
        BuildLabel: "2026.10.22.13.12/"
    }).save();
    const target = await new Account({
        email: "ws-target@example.com",
        password: "secret",
        DisplayName: "WsTarget",
        Nonce: 1002,
        ClientType: "webui",
        BuildLabel: "2026.10.22.13.12/"
    }).save();
    config.administratorNames = [admin.DisplayName];
    config.webui = { enabled: true, adminOnly: true };

    const server = createServer();
    startWsServer(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const ws = new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}`);
    t.after(async () => {
        config.administratorNames = previousAdmins;
        config.webui = previousWebui;
        ws.terminate();
        const pending: Promise<void>[] = [];
        stopWsServers(pending);
        await Promise.all(pending);
        await new Promise<void>(resolve => server.close(() => resolve()));
    });

    await new Promise<void>((resolve, reject) => {
        ws.once("open", () => resolve());
        ws.once("error", reject);
    });
    ws.send(
        JSON.stringify({
            auth: {
                email: admin.email,
                password: "secret",
                possessing: target._id.toString(),
                isRegister: false,
                allPermissions: ["addPlatinum"]
            }
        })
    );

    const authenticated = await waitForMessage<{ auth_succ?: { id: string }; permissions?: string[] }>(
        ws,
        message => message.auth_succ !== undefined
    );
    assert.equal(authenticated.auth_succ?.id, admin._id.toString());
    assert.deepEqual(authenticated.permissions, ["addPlatinum"]);

    ws.send(JSON.stringify({ allPermissions: ["addPlatinum"] }));
    const refreshed = await waitForMessage<{ permissions?: string[] }>(
        ws,
        message => message.permissions !== undefined
    );
    assert.deepEqual(refreshed.permissions, ["addPlatinum"]);
});
