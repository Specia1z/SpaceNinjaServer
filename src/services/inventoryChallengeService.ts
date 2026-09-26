import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type {
    IChallengeProgress,
    ISeasonChallenge,
    IWeeklyMissionChallengeInfo
} from "../types/inventoryTypes/inventoryTypes.ts";
import type { IInventoryChanges, IAffiliationMods } from "../types/purchaseTypes.ts";
import { getChallenge, getChallengeByName } from "./adminItemDataService.ts";
import { getCalendarProgress } from "./calendarProgressService.ts";
import { getCalendarSeason, getNightwaveSyndicateTag, getWorldStateTime } from "./worldStateService.ts";
import { createMessage } from "./inboxService.ts";
import { convertInboxMessage, fromStoreItem } from "./itemDataService.ts";
import { addString } from "../helpers/stringHelpers.ts";
import { logger } from "../utils/logger.ts";
import { KAHL_EPOCH, unixTimesInMs } from "../constants/timeConstants.ts";

type TAddChallengeItem = (
    inventory: TInventoryDatabaseDocument,
    typeName: string,
    quantity?: number
) => Promise<IInventoryChanges>;

type TCombineInventoryChanges = (changes: IInventoryChanges, delta: IInventoryChanges) => void;

export const applyChallenges = async (
    buildVersion: number,
    inventory: TInventoryDatabaseDocument,
    challengeProgress: IChallengeProgress[],
    seasonChallengeCompletions: ISeasonChallenge[] | undefined,
    inventoryChanges: IInventoryChanges,
    nightwaveStandingMultiplier: number,
    addChallengeItem: TAddChallengeItem,
    combineInventoryChanges: TCombineInventoryChanges
): Promise<IAffiliationMods[]> => {
    for (const { Name, Progress, Completed } of challengeProgress) {
        let dbChallenge = inventory.ChallengeProgress.find(x => x.Name == Name);
        if (dbChallenge) dbChallenge.Progress = Progress;
        else {
            dbChallenge = { Name, Progress };
            inventory.ChallengeProgress.push(dbChallenge);
        }

        if (Name.startsWith("Calendar")) {
            const { week } = getWorldStateTime();
            const currentSeason = getCalendarSeason(week);
            addString(getCalendarProgress(inventory, currentSeason).SeasonProgress.ActivatedChallenges, Name);
        }

        if ((Completed?.length ?? 0) > (dbChallenge.Completed?.length ?? 0)) {
            dbChallenge.Completed ??= [];
            for (const completion of Completed!) {
                if (dbChallenge.Completed.includes(completion)) continue;
                dbChallenge.Completed.push(completion);
                if (completion != "challengeRewards") continue;
                const challenge = getChallengeByName(Name);
                if (!challenge) {
                    logger.warn(`ignoring unknown challenge completion`, { name: Name, completion });
                    dbChallenge.Progress = 0;
                    dbChallenge.Completed = [];
                    continue;
                }
                const { path, meta } = challenge;
                if (meta.message) {
                    logger.debug(`${Name} completed, sending inbox message`);
                    await createMessage(inventory.accountOwnerId, [convertInboxMessage(meta.message)]);
                } else if (meta.countedRewards) {
                    logger.debug(`${Name} completed, giving rewards:`, meta.countedRewards);
                    for (const reward of meta.countedRewards) {
                        combineInventoryChanges(
                            inventoryChanges,
                            await addChallengeItem(inventory, fromStoreItem(reward.StoreItem), reward.ItemCount)
                        );
                    }
                } else {
                    logger.warn(`ignoring unknown challenge completion`, { name: Name, path, completion, meta });
                    dbChallenge.Progress = 0;
                    dbChallenge.Completed = [];
                }
            }
        } else {
            dbChallenge.Completed = Completed;
        }
    }

    const affiliationMods: IAffiliationMods[] = [];
    for (const challenge of seasonChallengeCompletions ?? []) {
        if (!challengeProgress.find(progress => challenge.challenge.includes(progress.Name))) continue;
        const meta = getChallenge(challenge.challenge);
        if (!meta) {
            logger.warn("ignoring unknown season challenge completion", { uniqueName: challenge.challenge });
            continue;
        }
        const syndicateTag = getNightwaveSyndicateTag(buildVersion);
        logger.debug("Completed season challenge", { uniqueName: challenge.challenge, syndicateTag, ...meta });
        if (!syndicateTag) continue;
        let affiliation = inventory.Affiliations.find(x => x.Tag == syndicateTag);
        if (!affiliation) {
            affiliation = inventory.Affiliations[inventory.Affiliations.push({ Tag: syndicateTag, Standing: 0 }) - 1];
        }
        const standingToAdd = Math.trunc(
            meta.standing! * (inventory.nightwaveStandingMultiplier ?? 1) * nightwaveStandingMultiplier
        );
        affiliation.Standing += standingToAdd;
        affiliationMods[0] ??= { Tag: syndicateTag };
        affiliationMods[0].Standing ??= 0;
        affiliationMods[0].Standing += standingToAdd;
    }
    return affiliationMods;
};

export const resetKahlWeeklyMission = (
    inventory: Pick<TInventoryDatabaseDocument, "Affiliations">,
    value: string
): void => {
    const currentWeek = Math.trunc((Date.now() - KAHL_EPOCH) / unixTimesInMs.week);
    const kahl = inventory.Affiliations.find(x => x.Tag == "KahlSyndicate");
    if (kahl && kahl.WeeklyMissions) {
        const index = kahl.WeeklyMissions.findIndex(i => i.WeekCount == Number(value.slice("KahlSyndicate_".length)));
        if (index !== -1) {
            logger.debug(`kahl weekly mission completed, handling weekly reset`);
            kahl.WeeklyMissions[index].CompletedMission = true;
            if (kahl.WeeklyMissions.findIndex(i => i.WeekCount == currentWeek + 1) == -1) {
                kahl.WeeklyMissions.splice(0, kahl.WeeklyMissions.length, kahl.WeeklyMissions[index]);
                kahl.WeeklyMissions.push({
                    MissionIndex: kahl.WeeklyMissions[kahl.WeeklyMissions.length - 1].MissionIndex + 1,
                    CompletedMission: false,
                    JobManifest: "/Lotus/Syndicates/Kahl/KahlJobManifestVersionThree",
                    Challenges: [],
                    WeekCount: currentWeek + 1
                });
            }
        }
    }
};

type TAddKahlStock = (
    inventory: Pick<TInventoryDatabaseDocument, "MiscItems">,
    type: string,
    count: number,
    inventoryChanges: IInventoryChanges
) => void;

export const applyKahlProgress = (
    inventory: Pick<TInventoryDatabaseDocument, "Affiliations" | "MiscItems">,
    value: IWeeklyMissionChallengeInfo[],
    inventoryChanges: IInventoryChanges,
    addStock: TAddKahlStock
): void => {
    for (const info of value) {
        let stockEarned = 0;
        const kahl = inventory.Affiliations.find(x => x.Tag == info.Syndicate)!;
        const mission = kahl.WeeklyMissions!.find(i => i.WeekCount == info.WeekCount)!;
        if (info.ResetChallenges) {
            mission.ChallengesReset = true;
        }
        for (const challenge of info.CompletedChallenges) {
            if (mission.Challenges.indexOf(challenge) == -1) {
                stockEarned += challenge == "/Lotus/Types/Challenges/KahlMissions/NoDeathKahlChallenge" ? 30 : 15;
                mission.Challenges.push(challenge);
            }
        }
        logger.debug(`adding ${stockEarned} stock for kahl challenges`);
        addStock(inventory, "/Lotus/Types/Items/MiscItems/KahlCreds", stockEarned, inventoryChanges);
    }
};
