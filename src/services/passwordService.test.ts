import assert from "node:assert/strict";
import { test } from "node:test";
import { hashAccountPassword, verifyAccountPassword } from "./passwordService.ts";

void test("password hashing verifies new and legacy account passwords", async () => {
    const password = "correct horse battery staple";
    const hashed = await hashAccountPassword(password);

    assert.match(hashed, /^scrypt:v1:[a-f0-9]{48}:[a-f0-9]{128}$/);
    assert.equal(await verifyAccountPassword(password, hashed), true);
    assert.equal(await verifyAccountPassword("wrong", hashed), false);
    assert.equal(await verifyAccountPassword(password, password), true);
    assert.equal(await verifyAccountPassword("wrong", password), false);
});
