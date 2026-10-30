import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import { config } from "./configService.ts";
import { verifyClientInventoryUpdates } from "./antiCheatService.ts";
import { getEidolonCaptureCount } from "./missionInventoryUpdateService.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";

const account = {
    _id: new Types.ObjectId(),
    DisplayName: "anti-cheat-test"
};

const context = {
    requestId: "anti-cheat-test-request",
    buildLabel: "2026.10.22.13.12/"
};

void test("mission reports cannot claim Prime Vault FusionBundles", () => {
    const previousAntiCheat = config.antiCheat;
    config.antiCheat = {
        enabled: true,
        responseMode: "observe",
        maxClientFusionPointsPerReport: 100000
    };
    try {
        const report = {
            FusionBundles: [
                {
                    ItemType: "/Lotus/Upgrades/Mods/FusionBundles/MPVDualPackFusionBundle",
                    ItemCount: 2000
                }
            ]
        } as unknown as IMissionInventoryUpdateRequest;

        assert.equal(verifyClientInventoryUpdates(account, report, context), false);
        assert.deepEqual(report.FusionBundles, []);
    } finally {
        config.antiCheat = previousAntiCheat;
    }
});

void test("mission reports retain normal FusionBundles and cap total Endo", () => {
    const previousAntiCheat = config.antiCheat;
    config.antiCheat = {
        enabled: true,
        responseMode: "observe",
        maxClientFusionPointsPerReport: 100000
    };
    try {
        const normalReport = {
            FusionBundles: [
                {
                    ItemType: "/Lotus/Upgrades/Mods/FusionBundles/CommonFusionBundle",
                    ItemCount: 2
                }
            ]
        } as unknown as IMissionInventoryUpdateRequest;
        assert.equal(verifyClientInventoryUpdates(account, normalReport, context), true);
        assert.deepEqual(normalReport.FusionBundles, [
            {
                ItemType: "/Lotus/Upgrades/Mods/FusionBundles/CommonFusionBundle",
                ItemCount: 2
            }
        ]);

        const excessiveReport = {
            FusionBundles: [
                {
                    ItemType: "/Lotus/Upgrades/Mods/FusionBundles/EndoJackpotBundle",
                    ItemCount: 10
                }
            ]
        } as unknown as IMissionInventoryUpdateRequest;
        assert.equal(verifyClientInventoryUpdates(account, excessiveReport, context), false);
        assert.deepEqual(excessiveReport.FusionBundles, [
            {
                ItemType: "/Lotus/Upgrades/Mods/FusionBundles/EndoJackpotBundle",
                ItemCount: 6
            }
        ]);
    } finally {
        config.antiCheat = previousAntiCheat;
    }
});

void test("Eidolon platinum bonuses use the configured capture cap", () => {
    assert.equal(getEidolonCaptureCount([1, 2, 3], 1), 1);
    assert.equal(getEidolonCaptureCount([1], 1, 1), 0);
    assert.equal(getEidolonCaptureCount([1, 2, 3], 0), 3);
    assert.equal(getEidolonCaptureCount(undefined, 1), 0);
});
