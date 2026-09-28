import assert from "node:assert/strict";
import path from "node:path";
import tls from "node:tls";
import { test } from "node:test";
import { repoDir } from "../helpers/pathHelper.ts";
import { WarframeIrcServer } from "./ircService.ts";

class IrcTestClient {
    private readonly socket: tls.TLSSocket;
    private buffer = "";
    private readonly lines: string[] = [];
    private readonly waiters: {
        predicate: (line: string) => boolean;
        resolve: (line: string) => void;
    }[] = [];

    private constructor(socket: tls.TLSSocket) {
        this.socket = socket;
        socket.setEncoding("utf8");
        socket.on("error", () => {});
        socket.on("data", data => {
            this.buffer += String(data);
            let lineEnd = this.buffer.indexOf("\n");
            while (lineEnd != -1) {
                const line = this.buffer.substring(0, lineEnd).replace(/\r$/, "");
                this.buffer = this.buffer.substring(lineEnd + 1);
                const waiterIndex = this.waiters.findIndex(waiter => waiter.predicate(line));
                if (waiterIndex == -1) this.lines.push(line);
                else this.waiters.splice(waiterIndex, 1)[0].resolve(line);
                lineEnd = this.buffer.indexOf("\n");
            }
        });
    }

    public static connect(port: number): Promise<IrcTestClient> {
        return new Promise((resolve, reject) => {
            const socket = tls.connect({ host: "127.0.0.1", port, rejectUnauthorized: false });
            const onError = (error: Error): void => reject(error);
            socket.once("error", onError);
            socket.once("secureConnect", () => {
                socket.off("error", onError);
                resolve(new IrcTestClient(socket));
            });
        });
    }

    public send(line: string): void {
        this.socket.write(line + "\r\n");
    }

    public waitFor(predicate: (line: string) => boolean): Promise<string> {
        const lineIndex = this.lines.findIndex(predicate);
        if (lineIndex != -1) return Promise.resolve(this.lines.splice(lineIndex, 1)[0]);
        return new Promise((resolve, reject) => {
            const waiter = { predicate, resolve };
            this.waiters.push(waiter);
            const timeout = setTimeout(() => {
                const waiterIndex = this.waiters.indexOf(waiter);
                if (waiterIndex != -1) this.waiters.splice(waiterIndex, 1);
                reject(new Error("Timed out waiting for IRC response"));
            }, 3000);
            waiter.resolve = (line): void => {
                clearTimeout(timeout);
                resolve(line);
            };
        });
    }

    public async close(): Promise<void> {
        if (this.socket.destroyed) return;
        const closed = new Promise<void>(resolve => this.socket.once("close", () => resolve()));
        this.socket.end();
        await closed;
    }
}

const register = async (client: IrcTestClient, nick: string, accountId: string): Promise<void> => {
    client.send(`NICK ${nick}`);
    client.send(`USER ${accountId}_0 0 * :token=test-token`);
    await client.waitFor(line => line.includes(` 001 ${nick} `));
};

void test("TLS IRC supports U44 social commands and Unicode platform suffixes", async t => {
    const validatedAccountIds: string[] = [];
    const server = new WarframeIrcServer({
        address: "127.0.0.1",
        ports: [0],
        certFile: path.join(repoDir, "static/cert/cert.pem"),
        keyFile: path.join(repoDir, "static/cert/key.pem"),
        validateCredentials: (accountId, token): Promise<boolean> => {
            validatedAccountIds.push(accountId);
            return Promise.resolve(token == "test-token");
        }
    });
    const [port] = await server.start();
    t.after(() => server.stop());

    const lotusNick = "Lotus\uE000";
    const ordisNick = "Ordis\uE001";
    const lotus = await IrcTestClient.connect(port);
    const ordis = await IrcTestClient.connect(port);
    t.after(async () => {
        await Promise.all([lotus.close(), ordis.close()]);
    });
    const lotusAccountId = "6ab9efe99abfe032aae9a6bb";
    const ordisAccountId = "6aba30199abfe032aae9b8f5";
    await register(lotus, lotusNick, lotusAccountId);
    await register(ordis, ordisNick, ordisAccountId);
    assert.deepEqual(validatedAccountIds, [lotusAccountId, ordisAccountId]);

    const payload = "你好 : exact payload  ";
    lotus.send(`PRIVMSG Ordis :${payload}`);
    assert.equal(
        await ordis.waitFor(line => line.includes(" PRIVMSG ")),
        `:${lotusNick}!${lotusAccountId}_0@Soup PRIVMSG ${ordisNick} :${payload}`
    );

    const socialPayload =
        'social 31 {"NewFriendInfo":{"_id":{"$oid":"6ab9efe99abfe032aae9a6bb"},"DisplayName":"Lotus\uE000","ActiveAvatarImageType":"","PlayerLevel":0}}';
    lotus.send(`NOTICE ${ordisNick} :${socialPayload}`);
    assert.equal(
        await ordis.waitFor(line => line.includes(" NOTICE ")),
        `:${lotusNick}!${lotusAccountId}_0@Soup NOTICE ${ordisNick} :${socialPayload}`
    );

    lotus.send("ISON Ordis");
    assert.equal(await lotus.waitFor(line => line.includes(" 303 ")), `:Soup 303 ${lotusNick} :${ordisNick}`);

    ordis.send("AWAY :In mission");
    await ordis.waitFor(line => line.includes(" 306 "));
    lotus.send("WHOIS Ordis");
    assert.equal(
        await lotus.waitFor(line => line.includes(" 301 ")),
        `:Soup 301 ${lotusNick} ${ordisNick} :In mission`
    );

    lotus.send("MONITOR + Ordis");
    assert.equal(await lotus.waitFor(line => line.includes(" 730 ")), `:Soup 730 ${lotusNick} :${ordisNick}`);
    ordis.send("QUIT :test complete");
    assert.equal(await lotus.waitFor(line => line.includes(" 731 ")), `:Soup 731 ${lotusNick} :${ordisNick}`);
});
