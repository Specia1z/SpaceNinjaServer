import assert from "node:assert/strict";
import { test } from "node:test";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { ICalendarSeason } from "../types/worldStateTypes.ts";
import { getCalendarProgress } from "./calendarProgressService.ts";

const season = (year: number, type: ICalendarSeason["Season"]): ICalendarSeason => ({
    Activation: { $date: { $numberLong: "0" } },
    Expiry: { $date: { $numberLong: "0" } },
    Season: type,
    Days: [
        { day: 1, events: [] },
        { day: 2, events: [{ type: "CET_CHALLENGE", challenge: "DailyChallenge" }] }
    ],
    YearIteration: year,
    Version: 19,
    UpgradeAvaliabilityRequirements: []
});

void test("calendar progress initializes and resets when the season rolls over", () => {
    const inventory = { Affiliations: [] } as unknown as TInventoryDatabaseDocument;
    const winter = getCalendarProgress(inventory, season(1, "CST_WINTER"));
    winter.YearProgress.Upgrades.push("upgrade");
    winter.SeasonProgress.ActivatedChallenges.push("challenge");
    winter.SeasonProgress.LastCompletedDayIdx = 4;

    const spring = getCalendarProgress(inventory, season(2, "CST_SPRING"));
    assert.equal(spring.Iteration, 2);
    assert.deepEqual(spring.YearProgress.Upgrades, []);
    assert.deepEqual(spring.SeasonProgress.ActivatedChallenges, []);
    assert.equal(spring.SeasonProgress.LastCompletedDayIdx, -1);
    assert.equal(spring.SeasonProgress.LastCompletedChallengeDayIdx, -1);
});
