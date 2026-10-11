import assert from "node:assert/strict";
import { test } from "node:test";
import { BV_LATEST } from "../constants/gameVersions.ts";
import { EPOCH, unixTimesInMs } from "../constants/timeConstants.ts";
import { getInvasionRotationStatus, getLocalInvasionByOid, getLocalInvasions } from "./invasionRotationService.ts";

void test("local invasions are deterministic across refreshes", () => {
    const now = EPOCH + 12 * unixTimesInMs.day + 6 * unixTimesInMs.hour;
    const first = getLocalInvasions(BV_LATEST, now, 24);
    const second = getLocalInvasions(BV_LATEST, now, 24);

    assert.equal(first.length, 6);
    assert.deepEqual(first, second);
    assert.equal(first.filter(invasion => invasion.Completed).length, 3);
    assert.equal(first.filter(invasion => !invasion.Completed).length, 3);
});

void test("local invasion IDs resolve for custom rotation windows", () => {
    const now = EPOCH + 10 * unixTimesInMs.day + 3 * unixTimesInMs.hour;
    const invasions = getLocalInvasions(BV_LATEST, now, 6);
    const oid = invasions[0]._id.$oid;
    assert.ok(oid);
    const resolved = getLocalInvasionByOid(oid, BV_LATEST, 6, now);
    assert.deepEqual(resolved, invasions[0]);
});

void test("rotation status reports the deterministic settlement boundary", () => {
    const now = EPOCH + 5 * unixTimesInMs.day + 90 * unixTimesInMs.minute;
    const status = getInvasionRotationStatus(now, 2);
    assert.equal(status.rotationIndex, Math.floor((now - EPOCH) / (2 * unixTimesInMs.hour)));
    assert.equal(status.settlesAt.getTime() - status.startedAt.getTime(), 2 * unixTimesInMs.hour);
    assert.equal(status.nextRotationAt.getTime(), status.settlesAt.getTime());
});
