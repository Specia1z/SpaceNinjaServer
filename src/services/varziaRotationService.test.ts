import assert from "node:assert/strict";
import { test } from "node:test";
import type { IPrimeVaultTrader } from "../types/worldStateTypes.ts";
import { createVarziaRotationCache, getOfficialVarziaRotationPool } from "./varziaRotationService.ts";

const packA = "/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVRevenantBaruukPrimeDualPack";
const packB = "/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVNekrosOberonPrimeDualPack";
const newOfficialPack = "/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVProteaIvaraPrimeDualPack";

const trader = (currentPackage: string): IPrimeVaultTrader =>
    ({
        _id: { $oid: "varzia" },
        Activation: { $date: { $numberLong: "1000" } },
        Expiry: { $date: { $numberLong: "1000000" } },
        Node: "TradeHUB1",
        Manifest: [{ ItemType: currentPackage, PrimePrice: 10 }],
        EvergreenManifest: [],
        ScheduleInfo: [
            {
                Expiry: { $date: { $numberLong: "2000" } },
                FeaturedItem: packA
            },
            {
                Expiry: { $date: { $numberLong: "3000" } },
                FeaturedItem: "/Lotus/StoreItems/Types/StoreItems/Packages/MegaPrimeVault/LastChanceItemC"
            },
            {
                Expiry: { $date: { $numberLong: "4000" } },
                FeaturedItem: packB
            }
        ]
    }) as IPrimeVaultTrader;

void test("official Varzia schedule becomes a unique known package pool", () => {
    assert.deepEqual(getOfficialVarziaRotationPool(trader(packB)), [packA, packB]);
});

void test("the first cached official package becomes the custom rotation start", () => {
    const cache = createVarziaRotationCache([trader(packB)], 5000);
    assert.ok(cache);
    assert.equal(cache.rotationStartedAt, 5000);
    assert.equal(cache.currentPackage, packB);
    assert.deepEqual(cache.rotationPool, [packA, packB]);
    assert.equal(cache.startPoolIndex, 1);
    assert.deepEqual(cache.packageManifests[packB], cache.manifest);
});

void test("refreshing the official snapshot does not reset the local rotation start", () => {
    const first = createVarziaRotationCache([trader(packB)], 5000);
    assert.ok(first);
    const second = createVarziaRotationCache([trader(packA)], 9000, first);
    assert.ok(second);
    assert.equal(second.rotationStartedAt, 5000);
    assert.equal(second.startPoolIndex, 1);
    assert.equal(second.currentPackage, packA);
    assert.deepEqual(second.packageManifests[packB], first.manifest);
    assert.deepEqual(second.packageManifests[packA], second.manifest);
});

void test("new official dual packs are cached even when absent from the static catalog", () => {
    const officialTrader = trader(newOfficialPack);
    officialTrader.ScheduleInfo = [];
    const cache = createVarziaRotationCache([officialTrader], 5000);
    assert.ok(cache);
    assert.deepEqual(cache.rotationPool, [newOfficialPack]);
    assert.equal(cache.currentPackage, newOfficialPack);
});
