import assert from "node:assert/strict";
import { test } from "node:test";
import {
    config,
    getWorldStateBoostMultiplier,
    isWorldStateBoostActive,
    validateWorldStateBoostConfig,
    validateClientConfig
} from "./configService.ts";

void test("global world state boosts honor their shared expiry", () => {
    const previousWorldState = config.worldState;
    try {
        config.worldState = {
            creditBoostMultiplier: 2,
            affinityBoostMultiplier: 3,
            resourceBoostMultiplier: 4,
            boostExpiresAt: "2099-01-01T00:00:00.000Z"
        };
        assert.equal(isWorldStateBoostActive(Date.parse("2098-12-31T23:59:59.000Z")), true);
        assert.equal(getWorldStateBoostMultiplier("creditBoostMultiplier"), 2);

        config.worldState.boostExpiresAt = "2000-01-01T00:00:00.000Z";
        assert.equal(isWorldStateBoostActive(Date.parse("2000-01-02T00:00:00.000Z")), false);
        assert.equal(getWorldStateBoostMultiplier("creditBoostMultiplier"), undefined);
        assert.equal(getWorldStateBoostMultiplier("affinityBoostMultiplier"), undefined);
        assert.equal(getWorldStateBoostMultiplier("resourceBoostMultiplier"), undefined);
    } finally {
        config.worldState = previousWorldState;
    }
});

void test("global world state boost expiry accepts only timezone-qualified date-times", () => {
    assert.equal(validateWorldStateBoostConfig("worldState.boostExpiresAt", null), undefined);
    assert.equal(validateWorldStateBoostConfig("worldState.boostExpiresAt", ""), undefined);
    assert.equal(validateWorldStateBoostConfig("worldState.boostExpiresAt", "2099-01-01T00:00Z"), undefined);
    assert.match(validateWorldStateBoostConfig("worldState.boostExpiresAt", "2099-01-01T00:00:00") ?? "", /ISO 8601/);
});

void test("client configuration validates supported types and ranges", () => {
    assert.equal(validateClientConfig("client.server_host", "localhost"), undefined);
    assert.equal(validateClientConfig("client.http_port", 8080), undefined);
    assert.equal(validateClientConfig("client.fov_override", 90.5), undefined);
    assert.match(validateClientConfig("client.http_port", 0) ?? "", /1 to 65535/);
    assert.match(validateClientConfig("client.fallback_windowMode", 1.5) ?? "", /integer/);
    assert.match(validateClientConfig("client.secure_connections", "true") ?? "", /boolean/);
    assert.match(validateClientConfig("client.unknown", true) ?? "", /not a supported client setting/);
    assert.equal(validateClientConfig("webui.enabled", false), undefined);
});
