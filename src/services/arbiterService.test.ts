import assert from "node:assert/strict";
import { test } from "node:test";
import { assignEndpointPort } from "./arbiterService.ts";

void test("Hub endpoint assignments are stable and collision-free within a pool", () => {
    const address = "127.0.0.1:30000";
    const first = assignEndpointPort(address, "account-a", 2);
    const second = assignEndpointPort(address, "account-b", 2);

    assert.equal(assignEndpointPort(address, "account-a", 2), first);
    assert.notEqual(first, second);
    assert.match(first, /^127\.0\.0\.1:3000[01]$/);
    assert.match(second, /^127\.0\.0\.1:3000[01]$/);
    assert.throws(() => assignEndpointPort(address, "account-c", 2), /port pool exhausted/);
});

void test("Hub endpoint assignments preserve the base endpoint without an account or pool", () => {
    assert.equal(assignEndpointPort("localhost:6952", undefined, 16), "localhost:6952");
    assert.equal(assignEndpointPort("localhost:6952", "account-a", 1), "localhost:6952");
});
