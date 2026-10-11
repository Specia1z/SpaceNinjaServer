import { EPOCH, unixTimesInMs } from "../constants/timeConstants.ts";
import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";
import { BV_LATEST } from "../constants/gameVersions.ts";
import { config } from "./configService.ts";
import { sequentiallyUniqueRandomElement, SRng } from "./rngService.ts";
import { logger } from "../utils/logger.ts";
import type { ISeasonChallenge } from "../types/worldStateTypes.ts";
import { ExportSyndicates } from "warframe-public-export-plus";

export interface IRotatingSeasonChallengePools {
    daily: readonly string[];
    weekly: string[];
    hardWeekly: string[];
    weeklyPermanent: string[];
}

export const getSeasonChallengePools = (syndicateTag: string): IRotatingSeasonChallengePools => {
    if (syndicateTag in ExportSyndicates) {
        const syndicate = ExportSyndicates[syndicateTag];
        if (!syndicate.dailyChallenges || !syndicate.weeklyChallenges) {
            throw new Error(`invalid syndicate tag for nightwave: ${syndicateTag}`);
        }
        return {
            daily: syndicate.dailyChallenges,
            weekly: syndicate.weeklyChallenges.filter(
                x =>
                    x.startsWith("/Lotus/Types/Challenges/Seasons/Weekly/") &&
                    !x.startsWith("/Lotus/Types/Challenges/Seasons/Weekly/SeasonWeeklyPermanent")
            ),
            hardWeekly: syndicate.weeklyChallenges.filter(x =>
                x.startsWith("/Lotus/Types/Challenges/Seasons/WeeklyHard/")
            ),
            weeklyPermanent: syndicate.weeklyChallenges.filter(x =>
                x.startsWith("/Lotus/Types/Challenges/Seasons/Weekly/SeasonWeeklyPermanent")
            )
        };
    }
    return {
        daily: [],
        weekly: [],
        hardWeekly: [],
        weeklyPermanent: []
    };
};

export const getSeasonDailyChallenge = (pools: IRotatingSeasonChallengePools, day: number): ISeasonChallenge => {
    const dayStart = EPOCH + day * 86400000;
    const dayEnd = EPOCH + (day + 3) * 86400000;
    return {
        _id: { $oid: "67e1b5ca9d00cb47" + day.toString().padStart(8, "0") },
        Daily: true,
        Activation: { $date: { $numberLong: dayStart.toString() } },
        Expiry: { $date: { $numberLong: dayEnd.toString() } },
        Challenge: sequentiallyUniqueRandomElement(pools.daily, day, 2, 605732938)!
    };
};

const pushSeasonWeeklyChallenge = (
    activeChallenges: ISeasonChallenge[],
    pool: string[],
    nightwaveSeason: number,
    week: number,
    id: number
): void => {
    if (pool.length > 0) {
        const weekStart = EPOCH + week * 604800000;
        const weekEnd = weekStart + 604800000;
        const challengeId = week * 7 + id;
        const rng = new SRng(new SRng(challengeId).randomInt(0, 100_000));
        let challenge: string;
        do {
            challenge = rng.randomElement(pool)!;
        } while (activeChallenges.some(x => x.Challenge == challenge));
        activeChallenges.push({
            _id: {
                $oid:
                    (nightwaveSeason + 1).toString().padStart(4, "0") +
                    "bb2d9d00cb47" +
                    challengeId.toString().padStart(8, "0")
            },
            Activation: { $date: { $numberLong: weekStart.toString() } },
            Expiry: { $date: { $numberLong: weekEnd.toString() } },
            Challenge: challenge
        });
    }
};

export const pushWeeklyActs = (
    activeChallenges: ISeasonChallenge[],
    pools: IRotatingSeasonChallengePools,
    week: number,
    nightwaveStartTimestamp: number,
    nightwaveSeason: number
): void => {
    pushSeasonWeeklyChallenge(activeChallenges, pools.weekly, nightwaveSeason, week, 0);
    pushSeasonWeeklyChallenge(activeChallenges, pools.weekly, nightwaveSeason, week, 1);
    if (pools.weeklyPermanent.length > 0) {
        const weekStart = EPOCH + week * unixTimesInMs.week;
        const weekEnd = weekStart + unixTimesInMs.week;
        const nightwaveWeekStart = ((): number => {
            let ts = nightwaveStartTimestamp - EPOCH;
            ts -= ts % unixTimesInMs.week;
            return EPOCH + ts;
        })();
        const nightwaveWeek = Math.trunc((weekStart - nightwaveWeekStart) / unixTimesInMs.week);
        const weeklyPermanentIndex = (nightwaveWeek * 3) % pools.weeklyPermanent.length;
        for (let i = 0; i < 3; i++) {
            activeChallenges.push({
                _id: {
                    $oid:
                        (nightwaveSeason + 1).toString().padStart(4, "0") +
                        "b96e9d00cb47" +
                        (week * 7 + 2 + i).toString().padStart(8, "0")
                },
                Activation: { $date: { $numberLong: weekStart.toString() } },
                Expiry: { $date: { $numberLong: weekEnd.toString() } },
                Challenge: pools.weeklyPermanent[weeklyPermanentIndex + i]
            });
        }
    } else {
        pushSeasonWeeklyChallenge(activeChallenges, pools.weekly, nightwaveSeason, week, 2);
        pushSeasonWeeklyChallenge(activeChallenges, pools.weekly, nightwaveSeason, week, 3);
        pushSeasonWeeklyChallenge(activeChallenges, pools.weekly, nightwaveSeason, week, 4);
    }
    pushSeasonWeeklyChallenge(activeChallenges, pools.hardWeekly, nightwaveSeason, week, 5);
    pushSeasonWeeklyChallenge(activeChallenges, pools.hardWeekly, nightwaveSeason, week, 6);
};

export const getNightwaveSyndicateTag = (buildVersion: number = BV_LATEST): string | undefined => {
    if (config.worldState?.nightwaveOverride) {
        const override = config.worldState.nightwaveOverride;
        if (override == "disable") {
            return undefined;
        }
        if (!(override in nightwaveTagToSeason)) {
            logger.warn(`ignoring invalid config value for worldState.nightwaveOverride`, {
                value: override,
                valid_values: Object.keys(nightwaveTagToSeason)
            });
            return undefined;
        }
        return isNightwaveTagAvailable(override, buildVersion) ? override : undefined;
    }
    return Object.keys(nightwaveTagToSeason).find(tag => isNightwaveTagAvailable(tag, buildVersion));
};

const isNightwaveTagAvailable = (tag: string, buildVersion: number): boolean => {
    if (!(tag in nightwaveTagMinBuildVersion)) {
        return false;
    }
    const minBuildVersion = nightwaveTagMinBuildVersion[tag];
    return tag == "RadioLegionIntermission8Syndicate"
        ? buildVersion > gameToBuildVersionInt[minBuildVersion]
        : buildVersion >= gameToBuildVersionInt[minBuildVersion];
};

export const nightwaveTagToSeason: Record<string, number> = {
    RadioLegionIntermission16Syndicate: 18,
    RadioLegionIntermission15Syndicate: 17,
    RadioLegionIntermission14Syndicate: 16,
    RadioLegionIntermission13Syndicate: 15,
    RadioLegionIntermission12Syndicate: 14,
    RadioLegionIntermission11Syndicate: 13,
    RadioLegionIntermission10Syndicate: 12,
    RadioLegionIntermission9Syndicate: 11,
    RadioLegionIntermission8Syndicate: 10,
    RadioLegionIntermission7Syndicate: 9,
    RadioLegionIntermission6Syndicate: 8,
    RadioLegionIntermission5Syndicate: 7,
    RadioLegionIntermission4Syndicate: 6,
    RadioLegionIntermission3Syndicate: 5,
    RadioLegion3Syndicate: 4,
    RadioLegionIntermission2Syndicate: 3,
    RadioLegion2Syndicate: 2,
    RadioLegionIntermissionSyndicate: 1,
    RadioLegionSyndicate: 0
};

export const nightwaveTagToSeasonName: Record<string, string> = {
    RadioLegionIntermission16Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceThirteenSeasonTitle",
    RadioLegionIntermission15Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceTwelveSeasonTitle",
    RadioLegionIntermission14Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceElevenSeasonTitle",
    RadioLegionIntermission13Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceTenSeasonTitle",
    RadioLegionIntermission12Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceNineSeasonTitle",
    RadioLegionIntermission11Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceEightSeasonTitle",
    RadioLegionIntermission10Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceSevenSeasonTitle",
    RadioLegionIntermission9Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceSixSeasonTitle",
    RadioLegionIntermission8Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceFiveSeasonTitle",
    RadioLegionIntermission7Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceFourSeasonTitle",
    RadioLegionIntermission6Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceThreeSeasonTitle",
    RadioLegionIntermission5Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceTwoSeasonTitle",
    RadioLegionIntermission4Syndicate: "/Lotus/Language/Syndicates/RadioLegionNorasChoiceSeasonTitle",
    RadioLegionIntermission3Syndicate: "/Lotus/Language/Syndicates/RadioLegionShortSeasonTitle1",
    RadioLegion3Syndicate: "/Lotus/Language/Syndicates/RadioLegionSeasonTitle3",
    RadioLegionIntermission2Syndicate: "/Lotus/Language/Syndicates/RadioLegionShortSeasonTitle1",
    RadioLegion2Syndicate: "/Lotus/Language/Syndicates/RadioLegionSeasonTitle2",
    RadioLegionIntermissionSyndicate: "/Lotus/Language/Syndicates/RadioLegionShortSeasonTitle1",
    RadioLegionSyndicate: "/Lotus/Language/Syndicates/RadioLegionSeasonTitle1"
};

export const nightwaveTagToActivation: Record<string, number> = {
    RadioLegionIntermission16Syndicate: 1786548600000,
    RadioLegionIntermission15Syndicate: 1775662200000,
    RadioLegionIntermission14Syndicate: 1761589199000,
    // Historical entries only need day-level precision here because weekly acts are aligned to EPOCH weeks.
    RadioLegionIntermission13Syndicate: 1747785600000,
    RadioLegionIntermission12Syndicate: 1738800000000,
    RadioLegionIntermission11Syndicate: 1725321600000,
    RadioLegionIntermission10Syndicate: 1715731200000,
    RadioLegionIntermission9Syndicate: 1701216000000,
    RadioLegionIntermission8Syndicate: 1684886400000,
    RadioLegionIntermission7Syndicate: 1669766400000,
    RadioLegionIntermission6Syndicate: 1658016000000,
    RadioLegionIntermission5Syndicate: 1647475200000,
    RadioLegionIntermission4Syndicate: 1628035200000,
    RadioLegionIntermission3Syndicate: 1612137600000,
    RadioLegion3Syndicate: 1589241600000,
    RadioLegionIntermission2Syndicate: 1571616000000,
    RadioLegion2Syndicate: 1562371200000,
    RadioLegionIntermissionSyndicate: 1558224000000,
    RadioLegionSyndicate: 1551225600000
};

const nightwaveTagMinBuildVersion: Record<string, keyof typeof gameToBuildVersionInt> = {
    RadioLegionIntermission16Syndicate: "43.5.0",
    RadioLegionIntermission15Syndicate: "42.0.6",
    RadioLegionIntermission14Syndicate: "40.0.0",
    RadioLegionIntermission13Syndicate: "38.6.0",
    RadioLegionIntermission12Syndicate: "38.0.8",
    RadioLegionIntermission11Syndicate: "36.1.2",
    RadioLegionIntermission10Syndicate: "35.5.9",
    RadioLegionIntermission9Syndicate: "34.0.8",
    RadioLegionIntermission8Syndicate: "33.0.10",
    RadioLegionIntermission7Syndicate: "32.2.0",
    RadioLegionIntermission6Syndicate: "31.6.4",
    RadioLegionIntermission5Syndicate: "31.2.0",
    RadioLegionIntermission4Syndicate: "30.6.0",
    RadioLegionIntermission3Syndicate: "29.7.0",
    RadioLegion3Syndicate: "28.3.2",
    RadioLegionIntermission2Syndicate: "25.8.2",
    RadioLegion2Syndicate: "25.3.0",
    RadioLegionIntermissionSyndicate: "25.1.2",
    RadioLegionSyndicate: "24.3.0"
};
