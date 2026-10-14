import assert from "node:assert/strict";
import { test } from "node:test";
import { generateRedeemCode, normalizeRedeemCodeFormat } from "./redeemCodeFormat.ts";

void test("generates grouped random codes with a normalized prefix and selected alphabet", () => {
    const format = normalizeRedeemCodeFormat({
        Prefix: "spring-",
        CodeLength: 12,
        Alphabet: "digits",
        GroupSize: 4,
        Separator: "-"
    });
    const code = generateRedeemCode(format);

    assert.match(code, /^SPRING-\d{4}-\d{4}-\d{4}$/);
});

void test("keeps the existing random-code defaults and prefix contract", () => {
    const code = generateRedeemCode(normalizeRedeemCodeFormat({ CodeLength: 16, Prefix: "welcome-" }));

    assert.equal(code.length, 24);
    assert.ok(code.startsWith("WELCOME-"));
    assert.ok([...code.slice(8)].every(character => "ABCDEFGHJKMNPQRSTUVWXYZ23456789".includes(character)));
});

void test("generates codes using a validated custom alphabet", () => {
    const format = normalizeRedeemCodeFormat({
        Format: "random",
        CodeLength: 30,
        Alphabet: "custom",
        CustomAlphabet: "ABC123"
    });
    const code = generateRedeemCode(format);

    assert.equal(code.length, 30);
    assert.match(code, /^[ABC123]+$/);
});

void test("generates standard UUID v4 codes with the correct version and variant", () => {
    const format = normalizeRedeemCodeFormat({ Format: "uuid", Prefix: "event-" });
    const code = generateRedeemCode(format);

    assert.match(code, /^EVENT-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
});

void test("generates compact UUID v4 codes without separators", () => {
    const code = generateRedeemCode(normalizeRedeemCodeFormat({ Format: "uuid-compact" }));

    assert.match(code, /^[0-9A-F]{12}4[0-9A-F]{3}[89AB][0-9A-F]{15}$/);
});

void test("rejects invalid formats, alphabets, prefixes, and output lengths", () => {
    assert.throws(() => normalizeRedeemCodeFormat({ Format: "uuid-v7" }), /Format must be/);
    assert.throws(() => normalizeRedeemCodeFormat({ Alphabet: "custom", CustomAlphabet: "AABC" }), /CustomAlphabet/);
    assert.throws(() => normalizeRedeemCodeFormat({ Prefix: "bad prefix" }), /Prefix may contain/);
    assert.throws(() => normalizeRedeemCodeFormat({ Prefix: "TOO-LONG-", CodeLength: 60 }), /fit within/);
    assert.throws(
        () => normalizeRedeemCodeFormat({ CodeLength: 40, GroupSize: 2, Separator: "-", Prefix: "A".repeat(24) }),
        /fit within/
    );
});
