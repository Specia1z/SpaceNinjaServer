import assert from "node:assert/strict";
import { test } from "node:test";
import { addCrewShipFusionPoints, addFusionPoints, updateCredits, updatePlatinum } from "./inventoryFinanceService.ts";

void test("credits and free platinum track balance and inventory deltas", () => {
    const credits = { infiniteCredits: false, RegularCredits: 100 };
    const creditChanges = updateCredits(credits, 30);
    assert.equal(credits.RegularCredits, 70);
    assert.equal(creditChanges.RegularCredits, -30);
    assert.throws(() => updateCredits(credits, 71));
    assert.equal(credits.RegularCredits, 70);

    const platinum = { infinitePlatinum: false, PremiumCreditsFree: 10, PremiumCredits: 40 };
    const changes = updatePlatinum(platinum, 15);
    assert.deepEqual(changes, { PremiumCreditsFree: -10, PremiumCredits: -15 });
    assert.deepEqual(platinum, { infinitePlatinum: false, PremiumCreditsFree: 0, PremiumCredits: 25 });
});

void test("paid platinum cannot spend the free balance", () => {
    const platinum = { infinitePlatinum: false, PremiumCreditsFree: 10, PremiumCredits: 40 };
    assert.throws(() => updatePlatinum(platinum, 31, true));
    assert.equal(platinum.PremiumCredits, 40);
    assert.equal(platinum.PremiumCreditsFree, 10);
    assert.deepEqual(updatePlatinum(platinum, 30, true), { PremiumCredits: -30 });
});

void test("fusion points cap at signed 32-bit maximum and respect infinite flags", () => {
    const endo = { infiniteEndo: false, FusionPoints: 2147483645 };
    assert.equal(addFusionPoints(endo, 10), 2);
    assert.equal(endo.FusionPoints, 2147483647);
    const dirac = { infiniteDirac: true, CrewShipFusionPoints: 12 };
    assert.equal(addCrewShipFusionPoints(dirac, 200), 0);
    assert.equal(dirac.CrewShipFusionPoints, 12);
});
