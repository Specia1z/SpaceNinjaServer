import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { ICalendarProgress } from "../types/inventoryTypes/inventoryTypes.ts";
import type { ICalendarSeason } from "../types/worldStateTypes.ts";
import { logger } from "../utils/logger.ts";
import { getCalendarSeason, getWorldStateTime } from "./worldStateService.ts";

export const getCalendarProgress = (
    inventory: Pick<TInventoryDatabaseDocument, "CalendarProgress">,
    currentSeason: ICalendarSeason
): ICalendarProgress => {
    if (!inventory.CalendarProgress) {
        inventory.CalendarProgress = {
            Version: 19,
            Iteration: currentSeason.YearIteration,
            YearProgress: { Upgrades: [] },
            SeasonProgress: {
                SeasonType: currentSeason.Season,
                LastCompletedDayIdx: -1,
                LastCompletedChallengeDayIdx: -1,
                ActivatedChallenges: []
            }
        };
    }

    const yearRolledOver = inventory.CalendarProgress.Iteration != currentSeason.YearIteration;
    if (yearRolledOver) {
        inventory.CalendarProgress.Iteration = currentSeason.YearIteration;
        inventory.CalendarProgress.YearProgress.Upgrades = [];
    }
    if (yearRolledOver || inventory.CalendarProgress.SeasonProgress.SeasonType != currentSeason.Season) {
        inventory.CalendarProgress.SeasonProgress.SeasonType = currentSeason.Season;
        inventory.CalendarProgress.SeasonProgress.LastCompletedDayIdx = -1;
        inventory.CalendarProgress.SeasonProgress.LastCompletedChallengeDayIdx = -1;
        inventory.CalendarProgress.SeasonProgress.ActivatedChallenges = [];
    }

    return inventory.CalendarProgress;
};

export const addCalendarProgress = (inventory: TInventoryDatabaseDocument, value: { challenge: string }[]): void => {
    const { week } = getWorldStateTime();
    const currentSeason = getCalendarSeason(week);
    const calendarProgress = getCalendarProgress(inventory, currentSeason);
    calendarProgress.SeasonProgress.LastCompletedChallengeDayIdx = currentSeason.Days.findIndex(
        day => day.events.length != 0 && day.events[0].challenge == value[value.length - 1].challenge
    );
    checkCalendarAutoAdvance(inventory, currentSeason);
};

export const checkCalendarAutoAdvance = (
    inventory: TInventoryDatabaseDocument,
    currentSeason: ICalendarSeason
): void => {
    const calendarProgress = inventory.CalendarProgress!;
    for (
        let dayIndex = calendarProgress.SeasonProgress.LastCompletedDayIdx + 1;
        dayIndex != currentSeason.Days.length;
        ++dayIndex
    ) {
        const day = currentSeason.Days[dayIndex];
        if (day.events.length == 0) {
            // birthday
            if (day.day == 1) {
                // kaya
                if ((inventory.Affiliations.find(x => x.Tag == "HexSyndicate")?.Title || 0) >= 4) {
                    break;
                }
                logger.debug(`cannot talk to kaya, skipping birthday`);
                calendarProgress.SeasonProgress.LastCompletedDayIdx++;
            } else if (day.day == 74 || day.day == 355) {
                // minerva, velimir
                if ((inventory.Affiliations.find(x => x.Tag == "HexSyndicate")?.Title || 0) >= 5) {
                    break;
                }
                logger.debug(`cannot talk to minerva/velimir, skipping birthday`);
                calendarProgress.SeasonProgress.LastCompletedDayIdx++;
            } else {
                break;
            }
        } else if (day.events[0].type == "CET_CHALLENGE") {
            if (calendarProgress.SeasonProgress.LastCompletedChallengeDayIdx < dayIndex) {
                break;
            }
            logger.trace(`already completed the challenge, skipping ahead`);
            calendarProgress.SeasonProgress.LastCompletedDayIdx++;
        } else {
            break;
        }
    }
};
