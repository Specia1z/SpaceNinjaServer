import assert from "node:assert/strict";
import { test } from "node:test";
import { hashAccountPassword, verifyAccountPassword } from "./passwordService.ts";
import { whirlpoolHash } from "./whirlpoolService.ts";

void test("password hashing verifies new and legacy account passwords", async () => {
    const password = "correct horse battery staple";
    const hashed = await hashAccountPassword(password);

    assert.match(hashed, /^scrypt:v1:[a-f0-9]{48}:[a-f0-9]{128}$/);
    assert.equal(await verifyAccountPassword(password, hashed), true);
    assert.equal(await verifyAccountPassword("wrong", hashed), false);
    assert.equal(await verifyAccountPassword(password, password), true);
    assert.equal(await verifyAccountPassword("wrong", password), false);
});

void test("player login accepts passwords stored through the WebUI Whirlpool protocol", async () => {
    const password = "correct horse battery staple";
    const webuiPassword = whirlpoolHash(password);

    assert.match(webuiPassword, /^[a-f0-9]{128}$/);
    assert.equal(
        whirlpoolHash("abc"),
        "4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5"
    );
    assert.equal(await verifyAccountPassword(password, webuiPassword), true);
    assert.equal(await verifyAccountPassword(password, await hashAccountPassword(webuiPassword)), true);
    assert.equal(await verifyAccountPassword("", "not-empty"), false);
});
