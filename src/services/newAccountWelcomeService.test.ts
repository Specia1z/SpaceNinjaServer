import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNewAccountWelcomeMessage, normalizeNewAccountWelcomeConfig } from "./newAccountWelcomeService.ts";

void test("new-account welcome settings normalize duplicate rewards and build inbox attachments", () => {
    const settings = normalizeNewAccountWelcomeConfig({
        enabled: true,
        sender: "PlayWF",
        subject: "Welcome",
        body: "Welcome to PlayWF!",
        icon: "/Lotus/Interface/Icons/Npcs/Lotus_d.png",
        rewards: [
            { ItemType: "PremiumCredits", ItemCount: 200 },
            { ItemType: "PremiumCredits", ItemCount: 50 },
            { ItemType: "RegularCredits", ItemCount: 250_000 },
            { ItemType: "PremiumCreditsFree", ItemCount: 25 },
            { ItemType: "FusionPoints", ItemCount: 100 },
            { ItemType: "CrewShipFusionPoints", ItemCount: 50 },
            { ItemType: "PrimeTokens", ItemCount: 3 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 1_000 }
        ]
    });

    assert.deepEqual(settings.rewards, [
        { ItemType: "PremiumCredits", ItemCount: 250 },
        { ItemType: "RegularCredits", ItemCount: 250_000 },
        { ItemType: "PremiumCreditsFree", ItemCount: 25 },
        { ItemType: "FusionPoints", ItemCount: 100 },
        { ItemType: "CrewShipFusionPoints", ItemCount: 50 },
        { ItemType: "PrimeTokens", ItemCount: 3 },
        { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 1_000 }
    ]);
    assert.deepEqual(buildNewAccountWelcomeMessage(settings), {
        sndr: "PlayWF",
        sub: "Welcome",
        msg: "Welcome to PlayWF!",
        icon: "/Lotus/Interface/Icons/Npcs/Lotus_d.png",
        highPriority: true,
        PremiumCredits: 250,
        RegularCredits: 250_000,
        PrimeTokens: 3,
        countedAtt: [
            { ItemType: "PremiumCreditsFree", ItemCount: 25 },
            { ItemType: "FusionPoints", ItemCount: 100 },
            { ItemType: "CrewShipFusionPoints", ItemCount: 50 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 1_000 }
        ]
    });
});

void test("new-account welcome settings reject invalid reward paths and quantities", () => {
    assert.throws(
        () => normalizeNewAccountWelcomeConfig({ rewards: [{ ItemType: "not-an-item", ItemCount: 1 }] }),
        /currency name or a \/Lotus\/ item path/
    );
    assert.throws(
        () => normalizeNewAccountWelcomeConfig({ rewards: [{ ItemType: "PremiumCredits", ItemCount: 0 }] }),
        /whole number from 1/
    );
});

void test("disabled new-account welcome settings do not create a message", () => {
    assert.equal(buildNewAccountWelcomeMessage({ enabled: false }), undefined);
});
