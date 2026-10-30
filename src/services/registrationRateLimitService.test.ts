import assert from "node:assert/strict";
import { test } from "node:test";
import {
    config,
    normaliseBlockedClientAddresses,
    normaliseClientAddress,
    validateBlockedClientAddressesConfig,
    validateRegistrationRateLimitConfig
} from "./configService.ts";
import {
    getClientAddress,
    getRegistrationAddress,
    isBlockedClientAddress,
    reserveRegistration
} from "./registrationRateLimitService.ts";

void test("registration quotas share address and global budgets across entry points", t => {
    const previous = config.registrationRateLimit;
    config.registrationRateLimit = { windowMinutes: 1, perAddress: 2, global: 2 };
    t.after(() => {
        config.registrationRateLimit = previous;
    });

    const now = Date.now();
    const first = reserveRegistration("198.51.100.1", now);
    const second = reserveRegistration("198.51.100.1", now + 1);
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    const deniedAddress = reserveRegistration("198.51.100.1", now + 2);
    assert.equal(deniedAddress.allowed, false);
    assert.equal(deniedAddress.retryAfterSeconds, 60);
    second.cancel();
    // Failed writes still spend an address attempt but return their global reservation.
    assert.equal(reserveRegistration("198.51.100.1", now + 3).allowed, false);
    assert.equal(reserveRegistration("198.51.100.2", now + 3).allowed, true);
    assert.equal(reserveRegistration("198.51.100.3", now + 3).allowed, false);
    assert.equal(reserveRegistration("198.51.100.1", now + 60_001).allowed, true);
});

void test("forwarded addresses require an explicitly trusted proxy", t => {
    const previous = config.registrationRateLimit;
    config.registrationRateLimit = { trustedProxies: ["127.0.0.1", "10.0.0.9"] };
    t.after(() => {
        config.registrationRateLimit = previous;
    });
    assert.equal(getRegistrationAddress("::ffff:192.0.2.5", "198.51.100.25"), "192.0.2.5");
    assert.equal(getRegistrationAddress("127.0.0.1", "203.0.113.88, 198.51.100.25, 10.0.0.9"), "198.51.100.25");
    assert.equal(getRegistrationAddress("127.0.0.1", "invalid"), "127.0.0.1");
});

void test("client address blocklist matches normalized IP addresses", t => {
    const previous = config.blockedClientAddresses;
    const previousRateLimit = config.registrationRateLimit;
    t.after(() => {
        config.blockedClientAddresses = previous;
        config.registrationRateLimit = previousRateLimit;
    });
    config.blockedClientAddresses = ["::ffff:198.51.100.25", "not-an-ip"];

    assert.equal(getClientAddress("127.0.0.1", "198.51.100.25"), "127.0.0.1");
    assert.equal(isBlockedClientAddress(getClientAddress("127.0.0.1", "198.51.100.25")), false);
    config.registrationRateLimit = { trustedProxies: ["127.0.0.1"] };
    assert.equal(getClientAddress("127.0.0.1", "198.51.100.25"), "198.51.100.25");
    assert.equal(isBlockedClientAddress("198.51.100.25"), true);
    assert.equal(isBlockedClientAddress("198.51.100.26"), false);
});

void test("blocked client addresses are validated, normalized, and deduplicated", () => {
    assert.equal(normaliseClientAddress("  ::ffff:198.51.100.25 "), "198.51.100.25");
    assert.equal(normaliseClientAddress("not-an-ip"), undefined);
    assert.equal(validateBlockedClientAddressesConfig("blockedClientAddresses", ["198.51.100.25"]), undefined);
    assert.match(
        validateBlockedClientAddressesConfig("blockedClientAddresses", ["not-an-ip"]) ?? "",
        /valid IPv4 or IPv6/
    );
    assert.deepEqual(
        normaliseBlockedClientAddresses(["198.51.100.25", "::ffff:198.51.100.25", "2001:db8::1", "not-an-ip"]),
        ["198.51.100.25", "2001:db8::1"]
    );
});

void test("global attempt cap also covers failed account creation", t => {
    const previous = config.registrationRateLimit;
    config.registrationRateLimit = { windowMinutes: 1, perAddress: 10, global: 10, globalAttempts: 2 };
    t.after(() => {
        config.registrationRateLimit = previous;
    });
    const now = Date.now() + 120_000;
    const first = reserveRegistration("198.51.100.11", now);
    const second = reserveRegistration("198.51.100.12", now + 1);
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    first.cancel();
    second.cancel();
    const denied = reserveRegistration("198.51.100.13", now + 2);
    assert.equal(denied.allowed, false);
    assert.equal(denied.retryAfterSeconds, 60);
    assert.equal(reserveRegistration("198.51.100.13", now + 60_002).allowed, true);
});

void test("registration settings accept bounded integers only", () => {
    assert.equal(validateRegistrationRateLimitConfig("registrationRateLimit.perAddress", 3), undefined);
    assert.match(validateRegistrationRateLimitConfig("registrationRateLimit.global", 0) ?? "", /must be an integer/);
    assert.match(
        validateRegistrationRateLimitConfig("registrationRateLimit.windowMinutes", 1.5) ?? "",
        /must be an integer/
    );
});
