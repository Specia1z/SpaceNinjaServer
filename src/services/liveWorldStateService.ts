import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";
import type { ILiveGoalState, ILiveWorldActivityState, IWorldState } from "../types/worldStateTypes.ts";
import { buildVersionToInt } from "../helpers/versionHelper.ts";
import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";
import fissureMissions from "../../static/fixed_responses/worldState/fissureMissions.json" with { type: "json" };
import { sendWsBroadcastToGame } from "./wsService.ts";
import { ExportRegions, ExportSyndicates } from "warframe-public-export-plus";
import { getDescent, isCompatibleDescent } from "./descentService.ts";
import { factionToInt, getConquest, getMissionTypeForLegacyOverride, isCompatibleConquest } from "./conquestService.ts";
import { getEndlessXpChoices, isCompatibleEndlessXpSchedule } from "./circuitService.ts";
import baro from "../constants/baro.ts";
import darvoDeals from "../constants/darvoDeals.ts";
import type { ICachedVendorManifest } from "../types/vendorTypes.ts";
import { unixTimesInMs } from "../constants/timeConstants.ts";
import varzia from "../constants/varzia.ts";
import invasionNodes from "../../static/fixed_responses/worldState/invasionNodes.json" with { type: "json" };
import invasionRewards from "../../static/fixed_responses/worldState/invasionRewards.json" with { type: "json" };
import syndicateMissionNodes from "../../static/fixed_responses/worldState/syndicateMissions.json" with { type: "json" };
import { LiveGoalState, LiveWorldActivityState } from "../models/worldStateModel.ts";

const LIVE_WORLD_STATE_URL = "https://oracle.browse.wf/worldState.min.json";
const SUPPLEMENTAL_WORLD_STATE_URLS = [
    "https://cdn.jsdelivr.net/gh/calamity-inc/warframe-worldstate-history@senpai/worldState.json?source=browse.wf",
    "https://api.warframe.com/cdn/worldState.php"
];
const BOUNTY_CYCLE_URL = "https://oracle.browse.wf/bounty-cycle";
const INVASIONS_URL = "https://oracle.browse.wf/invasions";
const REFRESH_INTERVAL_MS = 60_000;

const liveWorldStateArrayKeys = [
    "Events",
    "Goals",
    "Alerts",
    "Sorties",
    "LiteSorties",
    "ActiveMissions",
    "VoidTraders",
    "VoidStorms",
    "DailyDeals",
    "Conquests"
] as const satisfies readonly (keyof IWorldState)[];

type TLiveWorldStateArrayKey = (typeof liveWorldStateArrayKeys)[number];
type ILiveWorldState = Pick<IWorldState, TLiveWorldStateArrayKey> &
    Partial<
        Pick<
            IWorldState,
            | "PrimeVaultTraders"
            | "Invasions"
            | "SyndicateMissions"
            | "SeasonInfo"
            | "KnownCalendarSeasons"
            | "Descents"
            | "EndlessXpSchedule"
            | "Tmp"
        >
    >;

interface IBountyCycle {
    expiry: number;
    bounties: Record<string, { node: string; challenge: string; ally?: string }[]>;
}

interface ICompactInvasions {
    activation: number;
    expiry: number;
    invasions: { id: string }[];
}

interface ISupplementalWorldState {
    worldState: Pick<
        IWorldState,
        | "PrimeVaultTraders"
        | "Invasions"
        | "SyndicateMissions"
        | "SeasonInfo"
        | "KnownCalendarSeasons"
        | "Descents"
        | "EndlessXpSchedule"
    >;
    freshnessMs: number;
}

const knownInvasionNodes = new Set(Object.values(invasionNodes).flat());
const knownInvasionRewards = new Set(
    Object.values(invasionRewards)
        .flatMap(rewards => Object.values(rewards))
        .flatMap(rewards => rewards.map(reward => reward.ItemType))
);
const liveInvasions = new Map<string, { invasion: IWorldState["Invasions"][number]; lastSeen: number }>();
const liveGoals = new Map<string, { goal: IWorldState["Goals"][number]; activationMs: number }>();
const liveSyndicateMissions = new Map<
    string,
    { mission: IWorldState["SyndicateMissions"][number]; lastSeen: number }
>();
const liveCalendarSeasons = new Map<number, IWorldState["KnownCalendarSeasons"][number]>();
const compatibleSyndicateTags = new Set([
    "ArbitersSyndicate",
    "CephalonSudaSyndicate",
    "NewLokaSyndicate",
    "PerrinSyndicate",
    "RedVeilSyndicate",
    "SteelMeridianSyndicate",
    "CetusSyndicate",
    "SolarisSyndicate",
    "EntratiSyndicate",
    "EntratiLabSyndicate",
    "ZarimanSyndicate",
    "HexSyndicate"
]);
const knownSyndicateMissionNodes = new Set(syndicateMissionNodes);
const bountyTags = new Set([
    "CetusSyndicate",
    "SolarisSyndicate",
    "EntratiSyndicate",
    "ZarimanSyndicate",
    "EntratiLabSyndicate",
    "HexSyndicate"
]);
const getSyndicateExpiry = (mission: IWorldState["SyndicateMissions"][number]): number =>
    "$date" in mission.Expiry
        ? Number(mission.Expiry.$date.$numberLong)
        : mission.Expiry.sec * 1000 + Math.trunc(mission.Expiry.usec / 1000);
const getSyndicateActivation = (mission: IWorldState["SyndicateMissions"][number]): number =>
    "$date" in mission.Activation
        ? Number(mission.Activation.$date.$numberLong)
        : mission.Activation.sec * 1000 + Math.trunc(mission.Activation.usec / 1000);
const nightwaveTagMinBuildVersion: Record<string, number> = {
    RadioLegionIntermission16Syndicate: gameToBuildVersionInt["43.5.0"],
    RadioLegionIntermission15Syndicate: gameToBuildVersionInt["42.0.6"],
    RadioLegionIntermission14Syndicate: gameToBuildVersionInt["40.0.0"],
    RadioLegionIntermission13Syndicate: gameToBuildVersionInt["38.6.0"],
    RadioLegionIntermission12Syndicate: gameToBuildVersionInt["38.0.8"],
    RadioLegionIntermission11Syndicate: gameToBuildVersionInt["36.1.2"],
    RadioLegionIntermission10Syndicate: gameToBuildVersionInt["35.5.9"],
    RadioLegionIntermission9Syndicate: gameToBuildVersionInt["34.0.8"],
    RadioLegionIntermission8Syndicate: gameToBuildVersionInt["33.0.10"],
    RadioLegionIntermission7Syndicate: gameToBuildVersionInt["32.2.0"],
    RadioLegionIntermission6Syndicate: gameToBuildVersionInt["31.6.4"],
    RadioLegionIntermission5Syndicate: gameToBuildVersionInt["30.5.0"],
    RadioLegionIntermission4Syndicate: gameToBuildVersionInt["29.5.0"],
    RadioLegionIntermission3Syndicate: gameToBuildVersionInt["27.3.0"],
    RadioLegionIntermission2Syndicate: gameToBuildVersionInt["26.0.0"],
    RadioLegionSyndicate: gameToBuildVersionInt["24.0.0"]
};
const knownNightwaveChallenges = new Set(
    Object.values(ExportSyndicates).flatMap(syndicate => [
        ...(syndicate.dailyChallenges ?? []),
        ...(syndicate.weeklyChallenges ?? [])
    ])
);

const baroOffers = [
    ...baro.evilBaro,
    ...baro.evergreen,
    ...baro.armorSets.flatMap(set => (set.bundle ? [...set.items, set.bundle] : set.items)),
    ...baro.rest
];
const baroOfferMinBuild = new Map(baroOffers.map(offer => [offer.ItemType, offer.minBuildVersionInt]));
const darvoDealMinBuild = new Map(darvoDeals.map(deal => [deal.StoreItem, deal.minBuildVersionInt]));

const teshinWeeklyOffers = [
    "/Lotus/StoreItems/Types/Recipes/Components/UmbraFormaBlueprint",
    "/Lotus/StoreItems/Types/Items/MiscItems/Kuva",
    "/Lotus/StoreItems/Upgrades/Mods/Randomized/RawModularPistolRandomMod",
    "/Lotus/StoreItems/Types/Items/MiscItems/Forma",
    "/Lotus/StoreItems/Upgrades/Mods/Randomized/RawModularMeleeRandomMod",
    "/Lotus/StoreItems/Upgrades/Mods/FusionBundles/EvergreenLoginRewardFusionBundle",
    "/Lotus/StoreItems/Upgrades/Mods/Randomized/RawRifleRandomMod",
    "/Lotus/StoreItems/Upgrades/Mods/Randomized/RawShotgunRandomMod"
] as const;
const teshinRotationEpoch = 1736121600_000;

const update41GoalTags = new Set([
    "12MinWarEvent",
    "DeimosHalloween",
    "DuviriMurmurEvent",
    "FortunaValentines",
    "FriendlyFireTacAlert",
    "FomorianEvent",
    "GalleonRobbery",
    "GhoulEmergence",
    "Halloween",
    "Halloween19Endless",
    "HeatFissure",
    "InfestedPlains",
    "JadeShadows",
    "JadeShadowsEvent",
    "LotusGift",
    "MechSurvival",
    "MechSurvivalA",
    "MechSurvivalB",
    "SquadLinkEvent",
    "WaterFight",
    "WolfHuntRedux"
]);

let cachedWorldState: ILiveWorldState | undefined;
let cachedWorldStateJson: string | undefined;
let cachedBountyCycle: IBountyCycle | undefined;
let activeInvasionIds: Set<string> | undefined;
let refreshPromise: Promise<void> | undefined;
let lastRefreshAttempt = 0;
let lastError: string | undefined;

const parseLiveWorldState = (value: unknown): ILiveWorldState => {
    if (!value || typeof value != "object") {
        throw new Error("response is not an object");
    }

    const candidate = value as Record<string, unknown>;
    for (const key of liveWorldStateArrayKeys) {
        if (!Array.isArray(candidate[key])) {
            throw new Error(`response field ${key} is not an array`);
        }
    }
    return {
        ...Object.fromEntries(liveWorldStateArrayKeys.map(key => [key, candidate[key]])),
        ...(typeof candidate.Tmp == "string" ? { Tmp: candidate.Tmp } : {})
    } as ILiveWorldState;
};

const isUpdate41Goal = (goal: IWorldState["Goals"][number]): boolean =>
    update41GoalTags.has(goal.Tag) || /^Anniversary\d+TacAlert(?:CM[A-Z])?$/.test(goal.Tag);

const getGoalDateMs = (date: IWorldState["Goals"][number]["Activation"]): number =>
    "$date" in date ? Number(date.$date.$numberLong) : date.sec * 1000 + Math.trunc(date.usec / 1000);

const getGoalOid = (goal: IWorldState["Goals"][number]): string => goal._id.$oid ?? goal._id.$id ?? "";

const getStaticGoalSnapshot = (goal: IWorldState["Goals"][number]): IWorldState["Goals"][number] => {
    const snapshot = structuredClone(goal);
    delete snapshot.Count;
    delete snapshot.CountAlt;
    delete snapshot.HealthPct;
    delete snapshot.Success;
    return snapshot;
};

const getGoalProgressMode = (goal: IWorldState["Goals"][number]): ILiveGoalState["progressMode"] => {
    if (goal.Count === undefined && goal.CountAlt === undefined && goal.HealthPct === undefined) {
        return "none";
    }
    return goal.Fomorian ? "depletion" : "additive";
};

const getGoalProgressTarget = (goal: IWorldState["Goals"][number]): number => {
    if (!goal.Fomorian && (("Community" in goal && goal.Community) || !goal.Personal) && goal.Goal && goal.Goal > 0) {
        return goal.Goal;
    }
    return 100;
};

const isKnownNode = (node: string): boolean => node.startsWith("EventNode") || node in ExportRegions;

const getCompatibleVoidTraders = (
    traders: IWorldState["VoidTraders"],
    buildVersion: number
): IWorldState["VoidTraders"] => {
    return traders.map(trader => {
        const manifest = (trader as Omit<typeof trader, "Manifest"> & { Manifest?: typeof trader.Manifest }).Manifest;
        return {
            ...trader,
            Manifest: (manifest ?? []).filter(offer => {
                const minBuild = baroOfferMinBuild.get(offer.ItemType);
                return minBuild !== undefined && buildVersion >= minBuild;
            })
        };
    });
};

const getCompatibleDailyDeals = (deals: IWorldState["DailyDeals"], buildVersion: number): IWorldState["DailyDeals"] =>
    deals.filter(deal => {
        const minBuild = darvoDealMinBuild.get(deal.StoreItem);
        return minBuild !== undefined && buildVersion >= minBuild;
    });

const getCompatibleInvasion = (value: unknown): IWorldState["Invasions"][number] | undefined => {
    if (!value || typeof value != "object") {
        return undefined;
    }

    const invasion = value as IWorldState["Invasions"][number];
    const oid = invasion._id.$oid;
    if (
        !oid ||
        !knownInvasionNodes.has(invasion.Node) ||
        !["FC_CORPUS", "FC_GRINEER", "FC_INFESTATION"].includes(invasion.Faction) ||
        !["FC_CORPUS", "FC_GRINEER", "FC_INFESTATION"].includes(invasion.DefenderFaction)
    ) {
        return undefined;
    }

    const normalizeReward = (reward: unknown): IWorldState["Invasions"][number]["AttackerReward"] | undefined => {
        if (Array.isArray(reward)) {
            return reward.length == 0 ? {} : undefined;
        }
        if (!reward || typeof reward != "object") {
            return undefined;
        }
        const normalized = reward as IWorldState["Invasions"][number]["AttackerReward"];
        if (
            normalized.credits !== undefined ||
            normalized.items !== undefined ||
            normalized.countedStoreItems !== undefined ||
            normalized.droptable !== undefined ||
            normalized.countedItems?.some(item => !knownInvasionRewards.has(item.ItemType))
        ) {
            return undefined;
        }
        return normalized;
    };

    const attackerReward = normalizeReward(invasion.AttackerReward);
    const defenderReward = normalizeReward(invasion.DefenderReward);
    return attackerReward && defenderReward
        ? { ...invasion, AttackerReward: attackerReward, DefenderReward: defenderReward }
        : undefined;
};

const getLocalInvasion = (state: ILiveWorldActivityState): IWorldState["Invasions"][number] => ({
    ...structuredClone(state.snapshot),
    Count: state.localCount,
    Goal: state.goal,
    Completed: state.status == "completed" || Math.abs(state.localCount) >= state.goal
});

const restoreLiveInvasions = async (): Promise<void> => {
    const states = await LiveWorldActivityState.find({
        type: "invasion",
        expiresAt: { $gt: new Date() }
    }).lean();
    liveInvasions.clear();
    for (const state of states) {
        liveInvasions.set(state.officialId, {
            invasion: getLocalInvasion(state as ILiveWorldActivityState),
            lastSeen: state.lastSeenAt.getTime()
        });
    }
};

const updateLiveInvasions = async (invasions: IWorldState["Invasions"]): Promise<void> => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * unixTimesInMs.day);
    await Promise.all(
        invasions.map(async invasion => {
            const officialId = invasion._id.$oid;
            if (!officialId) {
                return;
            }
            await LiveWorldActivityState.findOneAndUpdate(
                { type: "invasion", officialId },
                {
                    $set: {
                        snapshot: invasion,
                        goal: invasion.Goal,
                        lastSeenAt: now
                    },
                    $setOnInsert: {
                        type: "invasion",
                        officialId,
                        localCount: 0,
                        status: "active",
                        expiresAt: expiry
                    }
                },
                { upsert: true }
            );
            await LiveWorldActivityState.updateOne(
                { type: "invasion", officialId, status: "active" },
                { $set: { expiresAt: expiry } }
            );
        })
    );

    await restoreLiveInvasions();
};

export const advanceLiveInvasionProgress = async (
    oid: string,
    attackerScore: number,
    defenderScore: number,
    multiplier = 1
): Promise<void> => {
    if (!config.worldState?.liveSync || attackerScore == defenderScore) {
        return;
    }

    const current = liveInvasions.get(oid);
    if (!current) {
        return;
    }

    const direction = attackerScore > defenderScore ? 1 : -1;
    const runs = Math.max(1, Math.abs(attackerScore) + Math.abs(defenderScore));
    const amount = direction * Math.max(1, Math.ceil(current.invasion.Goal / 100)) * runs * multiplier;
    const state = await LiveWorldActivityState.findOneAndUpdate(
        { type: "invasion", officialId: oid, status: "active" },
        { $inc: { localCount: amount } },
        { new: true }
    );
    if (!state) {
        return;
    }

    const completed = Math.abs(state.localCount) >= state.goal;
    if (completed) {
        await LiveWorldActivityState.updateOne(
            { _id: state._id, status: "active" },
            {
                $set: {
                    status: "completed",
                    completedAt: new Date(),
                    expiresAt: new Date(Date.now() + 30 * unixTimesInMs.day)
                }
            }
        );
    }
    const snapshot = {
        ...current.invasion,
        Count: state.localCount,
        Goal: state.goal,
        Completed: completed
    };
    liveInvasions.set(oid, { invasion: snapshot, lastSeen: current.lastSeen });
    sendWsBroadcastToGame(undefined, { sync_world_state: true });
};

const getLocalGoal = (state: ILiveGoalState): IWorldState["Goals"][number] => {
    const goal = structuredClone(state.snapshot);
    if (state.hasCount) {
        goal.Count = state.count;
    }
    if (state.hasCountAlt) {
        goal.CountAlt = state.countAlt;
    }
    if (state.hasHealthPct) {
        goal.HealthPct = state.healthPct;
    }
    if (state.hasSuccess) {
        goal.Success = state.success;
    }
    return goal;
};

const restoreLiveGoals = async (): Promise<void> => {
    const states = await LiveGoalState.find({ expiresAt: { $gt: new Date() } })
        .sort({ activationMs: -1 })
        .lean();
    liveGoals.clear();
    for (const state of states) {
        if (!liveGoals.has(state.officialId)) {
            liveGoals.set(state.officialId, {
                goal: getLocalGoal(state as ILiveGoalState),
                activationMs: state.activationMs
            });
        }
    }
};

const updateLiveGoals = async (goals: IWorldState["Goals"]): Promise<void> => {
    const now = new Date();
    await Promise.all(
        goals.map(async goal => {
            const officialId = getGoalOid(goal);
            const activationMs = getGoalDateMs(goal.Activation);
            if (!officialId || !Number.isFinite(activationMs)) {
                return;
            }

            const progressMode = getGoalProgressMode(goal);
            const target = getGoalProgressTarget(goal);
            const officialExpiryMs = getGoalDateMs(goal.Expiry);
            const expiresAt = new Date(
                Math.max(
                    now.getTime() + 30 * unixTimesInMs.day,
                    (Number.isFinite(officialExpiryMs) ? officialExpiryMs : now.getTime()) + 30 * unixTimesInMs.day
                )
            );
            await LiveGoalState.findOneAndUpdate(
                { officialId, activationMs },
                {
                    $set: {
                        snapshot: getStaticGoalSnapshot(goal),
                        target,
                        progressMode,
                        hasCount: goal.Count !== undefined,
                        hasCountAlt: goal.CountAlt !== undefined,
                        hasHealthPct: goal.HealthPct !== undefined,
                        hasSuccess: goal.Success !== undefined,
                        lastSeenAt: now
                    },
                    $setOnInsert: {
                        officialId,
                        activationMs,
                        count: 0,
                        countAlt: 0,
                        healthPct: progressMode == "depletion" ? 1 : 0,
                        success: 0,
                        status: "active",
                        expiresAt
                    }
                },
                { upsert: true }
            );
            await LiveGoalState.updateOne({ officialId, activationMs, status: "active" }, { $set: { expiresAt } });
        })
    );
    await restoreLiveGoals();
};

export const advanceLiveGoalProgress = async (oid: string, contribution: number): Promise<void> => {
    if (!config.worldState?.liveSync || !Number.isFinite(contribution) || contribution <= 0) {
        return;
    }

    const current = liveGoals.get(oid);
    if (!current) {
        return;
    }

    const retentionMs = 30 * unixTimesInMs.day;
    const state = await LiveGoalState.findOneAndUpdate(
        {
            officialId: oid,
            activationMs: current.activationMs,
            status: "active",
            progressMode: { $ne: "none" }
        },
        [
            { $set: { count: { $add: ["$count", contribution] } } },
            {
                $set: {
                    healthPct: {
                        $cond: [
                            "$hasHealthPct",
                            {
                                $cond: [
                                    { $eq: ["$progressMode", "depletion"] },
                                    { $max: [0, { $subtract: [1, { $divide: ["$count", "$target"] }] }] },
                                    { $min: [1, { $divide: ["$count", "$target"] }] }
                                ]
                            },
                            "$healthPct"
                        ]
                    },
                    success: {
                        $cond: [{ $and: ["$hasSuccess", { $gte: ["$count", "$target"] }] }, 1, "$success"]
                    },
                    status: {
                        $cond: [{ $gte: ["$count", "$target"] }, "completed", "$status"]
                    },
                    completedAt: {
                        $cond: [{ $gte: ["$count", "$target"] }, { $ifNull: ["$completedAt", "$$NOW"] }, "$completedAt"]
                    },
                    expiresAt: {
                        $cond: [{ $gte: ["$count", "$target"] }, { $add: ["$$NOW", retentionMs] }, "$expiresAt"]
                    }
                }
            }
        ],
        { returnDocument: "after", updatePipeline: true }
    );
    if (!state) {
        return;
    }

    liveGoals.set(oid, {
        goal: getLocalGoal(state.toObject() as ILiveGoalState),
        activationMs: state.activationMs
    });
    sendWsBroadcastToGame(undefined, { sync_world_state: true });
};

const getCompatibleSyndicateMission = (value: unknown): IWorldState["SyndicateMissions"][number] | undefined => {
    if (!value || typeof value != "object") {
        return undefined;
    }
    const mission = value as IWorldState["SyndicateMissions"][number];
    const oid = mission._id.$oid;
    if (
        !oid ||
        !compatibleSyndicateTags.has(mission.Tag) ||
        !Array.isArray(mission.Nodes) ||
        mission.Nodes.some(node => !knownSyndicateMissionNodes.has(node))
    ) {
        return undefined;
    }
    return mission;
};

const mergeSyndicateMissions = (
    local: IWorldState["SyndicateMissions"],
    live: IWorldState["SyndicateMissions"],
    bountyCycle?: IBountyCycle,
    now = Date.now()
): IWorldState["SyndicateMissions"] => {
    // The compact bounty-cycle nodes are display data, not SyndicateMissions.Nodes.
    const compatibleLive = live.filter(
        mission =>
            getSyndicateExpiry(mission) > now &&
            (!bountyCycle || !bountyTags.has(mission.Tag) || getSyndicateExpiry(mission) == bountyCycle.expiry)
    );
    const merged = local.filter(
        mission =>
            !compatibleLive.some(
                replacement =>
                    mission.Tag == replacement.Tag &&
                    getSyndicateActivation(mission) < getSyndicateExpiry(replacement) &&
                    getSyndicateExpiry(mission) > getSyndicateActivation(replacement)
            )
    );
    return [...merged, ...compatibleLive];
};

const updateLiveSyndicateMissions = (missions: IWorldState["SyndicateMissions"]): void => {
    const now = Date.now();
    for (const mission of missions) {
        const id = mission._id.$oid;
        if (id) {
            liveSyndicateMissions.set(id, { mission, lastSeen: now });
        }
    }
    for (const [id, entry] of liveSyndicateMissions) {
        if (now - entry.lastSeen > 30 * unixTimesInMs.day) {
            liveSyndicateMissions.delete(id);
        }
    }
};

const getCalendarDateMs = (date: IWorldState["KnownCalendarSeasons"][number]["Activation"]): number =>
    Number(date.$date.$numberLong);

const getCompatibleCalendarSeason = (
    value: unknown,
    buildVersion: number
): IWorldState["KnownCalendarSeasons"][number] | undefined => {
    if (buildVersion < gameToBuildVersionInt["38.0.0"] || !value || typeof value != "object") {
        return undefined;
    }
    const season = value as IWorldState["KnownCalendarSeasons"][number];
    if (
        !season.Activation.$date.$numberLong ||
        !season.Expiry.$date.$numberLong ||
        season.Version > 19 ||
        !season.UpgradeAvaliabilityRequirements.includes("/Lotus/Upgrades/Calendar/1999UpgradeApplicationRequirement")
    ) {
        return undefined;
    }
    const days = season.Days.map(day => ({
        ...day,
        events: day.events.filter(event => {
            if (event.type == "CET_CHALLENGE") {
                return event.challenge?.startsWith("/Lotus/Types/Challenges/Calendar1999/") == true;
            }
            if (event.type == "CET_REWARD") {
                return event.reward?.startsWith("/Lotus/") == true;
            }
            if (event.type == "CET_UPGRADE") {
                return event.upgrade?.startsWith("/Lotus/Upgrades/Calendar/") == true;
            }
            return event.type == "CET_PLOT";
        })
    }));
    return { ...season, Days: days };
};

const updateLiveCalendarSeasons = (seasons: IWorldState["KnownCalendarSeasons"]): void => {
    for (const season of seasons) {
        liveCalendarSeasons.set(getCalendarDateMs(season.Activation), season);
    }
};

const getCompatibleSeasonInfo = (
    value: unknown,
    buildVersion: number
): NonNullable<IWorldState["SeasonInfo"]> | undefined => {
    if (!value || typeof value != "object") {
        return undefined;
    }
    const seasonInfo = value as NonNullable<IWorldState["SeasonInfo"]>;
    if (!(seasonInfo.AffiliationTag in nightwaveTagMinBuildVersion)) {
        return undefined;
    }
    const minBuildVersion = nightwaveTagMinBuildVersion[seasonInfo.AffiliationTag];
    if (buildVersion < minBuildVersion) {
        return undefined;
    }
    const activeChallenges = seasonInfo.ActiveChallenges.filter(challenge =>
        knownNightwaveChallenges.has(challenge.Challenge)
    );
    if (seasonInfo.ActiveChallenges.length > 0 && activeChallenges.length == 0) {
        return undefined;
    }
    return { ...seasonInfo, ActiveChallenges: activeChallenges };
};

const getUpdate41PrimeVaultSchedule = (
    trader: IWorldState["PrimeVaultTraders"][number]
): IWorldState["PrimeVaultTraders"][number]["ScheduleInfo"] => {
    const featuredItem = trader.Manifest.find(offer => offer.ItemType in varzia.primeDualPacks)?.ItemType;
    return featuredItem
        ? [
              {
                  Expiry: trader.Expiry,
                  PreviewHiddenUntil: { $date: { $numberLong: "0" } },
                  FeaturedItem: featuredItem
              }
          ]
        : [];
};

const parseSupplementalWorldState = (
    worldState: Partial<IWorldState>,
    freshnessMs: number
): ISupplementalWorldState => {
    if (
        !Array.isArray(worldState.PrimeVaultTraders) ||
        !Array.isArray(worldState.Invasions) ||
        !Array.isArray(worldState.SyndicateMissions) ||
        !Array.isArray(worldState.KnownCalendarSeasons) ||
        !worldState.SeasonInfo
    ) {
        throw new Error("supplemental world state fields are missing");
    }
    const primeVaultTraders = worldState.PrimeVaultTraders.map(trader => {
        const scheduleInfo = (
            trader as Omit<typeof trader, "ScheduleInfo"> & {
                ScheduleInfo?: typeof trader.ScheduleInfo;
            }
        ).ScheduleInfo;
        return { ...trader, ScheduleInfo: scheduleInfo ?? [] };
    });
    const invasions = worldState.Invasions.map(getCompatibleInvasion).filter(
        (invasion): invasion is IWorldState["Invasions"][number] => invasion !== undefined
    );
    const syndicateMissions = worldState.SyndicateMissions.map(getCompatibleSyndicateMission).filter(
        (mission): mission is IWorldState["SyndicateMissions"][number] => mission !== undefined
    );
    const knownCalendarSeasons = worldState.KnownCalendarSeasons.map(season =>
        getCompatibleCalendarSeason(season, gameToBuildVersionInt["42.0.0"])
    ).filter((season): season is IWorldState["KnownCalendarSeasons"][number] => season !== undefined);
    return {
        freshnessMs,
        worldState: {
            PrimeVaultTraders: primeVaultTraders,
            Invasions: invasions,
            SyndicateMissions: syndicateMissions,
            SeasonInfo: worldState.SeasonInfo,
            KnownCalendarSeasons: knownCalendarSeasons,
            Descents: worldState.Descents ?? [],
            EndlessXpSchedule: worldState.EndlessXpSchedule ?? []
        }
    };
};

const newestSupplemental = (results: ISupplementalWorldState[]): ISupplementalWorldState => {
    if (results.length == 0) {
        throw new Error("no valid supplemental world state source");
    }
    return results.reduce((newest, result) => (result.freshnessMs > newest.freshnessMs ? result : newest));
};

const fetchSupplementalWorldState = async (signal: AbortSignal): Promise<ISupplementalWorldState> => {
    const received: ISupplementalWorldState[] = [];
    const requests = SUPPLEMENTAL_WORLD_STATE_URLS.map(async url => {
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`${url}: HTTP ${response.status}`);
        }
        const worldState = (await response.json()) as Partial<IWorldState>;
        const bodyTime = typeof worldState.Time == "number" ? worldState.Time * 1000 : 0;
        const headerTime = Date.parse(response.headers.get("last-modified") ?? "") || 0;
        const result = parseSupplementalWorldState(worldState, bodyTime || headerTime);
        received.push(result);
        return result;
    });
    const first = await Promise.any(requests);
    if (Date.now() - first.freshnessMs > 2 * 60_000) {
        await Promise.allSettled(requests);
    } else {
        await Promise.race([Promise.allSettled(requests), new Promise<void>(resolve => setTimeout(resolve, 1500))]);
    }
    const newest = newestSupplemental(received);
    if (Date.now() - newest.freshnessMs > 10 * 60_000) {
        throw new Error("supplemental world state is stale");
    }
    return newest;
};

const fetchBrowseActivity = async (
    signal: AbortSignal
): Promise<{ bountyCycle?: IBountyCycle; invasionIds?: Set<string> }> => {
    const activitySignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);
    const [bountyResult, invasionsResult] = await Promise.all([
        fetch(BOUNTY_CYCLE_URL, { signal: activitySignal })
            .then(async response => (response.ok ? ((await response.json()) as IBountyCycle) : undefined))
            .catch(() => undefined),
        fetch(INVASIONS_URL, { signal: activitySignal })
            .then(async response => (response.ok ? ((await response.json()) as ICompactInvasions) : undefined))
            .catch(() => undefined)
    ]);
    return {
        bountyCycle:
            bountyResult && Number.isFinite(bountyResult.expiry) && bountyResult.expiry > Date.now()
                ? bountyResult
                : undefined,
        invasionIds:
            invasionsResult &&
            invasionsResult.activation * 1000 <= Date.now() &&
            invasionsResult.expiry * 1000 > Date.now() &&
            Array.isArray(invasionsResult.invasions)
                ? new Set(invasionsResult.invasions.map(invasion => invasion.id))
                : undefined
    };
};

const fetchSupplementalAndActivity = async (): Promise<
    ISupplementalWorldState & {
        bountyCycle?: IBountyCycle;
        invasionIds?: Set<string>;
    }
> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
        const [supplemental, activity] = await Promise.all([
            fetchSupplementalWorldState(controller.signal),
            fetchBrowseActivity(controller.signal)
        ]);
        return { ...supplemental, ...activity };
    } finally {
        clearTimeout(timeout);
        controller.abort();
    }
};

const fetchLiveWorldState = async (): Promise<void> => {
    try {
        const response = await fetch(LIVE_WORLD_STATE_URL, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const liveWorldState = parseLiveWorldState(await response.json());
        await updateLiveGoals(liveWorldState.Goals);
        try {
            const supplementalWorldState = await fetchSupplementalAndActivity();
            const activityIds = supplementalWorldState.invasionIds;
            const matchedInvasions = supplementalWorldState.worldState.Invasions.filter(invasion =>
                activityIds ? activityIds.has(invasion._id.$oid ?? "") : !invasion.Completed
            );
            const activeInvasions =
                activityIds?.size && matchedInvasions.length == 0
                    ? supplementalWorldState.worldState.Invasions.filter(invasion => !invasion.Completed)
                    : matchedInvasions;
            liveWorldState.PrimeVaultTraders = supplementalWorldState.worldState.PrimeVaultTraders;
            liveWorldState.Invasions = activeInvasions;
            liveWorldState.SyndicateMissions = supplementalWorldState.worldState.SyndicateMissions;
            liveWorldState.SeasonInfo = supplementalWorldState.worldState.SeasonInfo;
            liveWorldState.KnownCalendarSeasons = supplementalWorldState.worldState.KnownCalendarSeasons;
            liveWorldState.Descents = supplementalWorldState.worldState.Descents;
            liveWorldState.EndlessXpSchedule = supplementalWorldState.worldState.EndlessXpSchedule;
            await updateLiveInvasions(activeInvasions);
            updateLiveSyndicateMissions(supplementalWorldState.worldState.SyndicateMissions);
            updateLiveCalendarSeasons(supplementalWorldState.worldState.KnownCalendarSeasons);
            cachedBountyCycle = supplementalWorldState.bountyCycle;
            activeInvasionIds = new Set(activeInvasions.map(invasion => invasion._id.$oid ?? ""));
        } catch (e) {
            logger.debug(`Could not supplement browse.wf world state with Prime Vault traders: ${String(e)}`);
        }
        const nextJson = JSON.stringify({
            ...liveWorldState,
            Goals: liveWorldState.Goals.map(getStaticGoalSnapshot)
        });
        const changed = nextJson != cachedWorldStateJson;
        cachedWorldState = liveWorldState;
        cachedWorldStateJson = nextJson;
        lastError = undefined;

        if (changed) {
            logger.info("Updated live world state from browse.wf.");
            sendWsBroadcastToGame(undefined, { sync_world_state: true });
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message != lastError) {
            logger.warn(`Could not update live world state from browse.wf: ${message}`);
            lastError = message;
        }
    }
};

export const refreshLiveWorldState = async (): Promise<void> => {
    if (!config.worldState?.liveSync) {
        cachedWorldState = undefined;
        cachedWorldStateJson = undefined;
        cachedBountyCycle = undefined;
        activeInvasionIds = undefined;
        liveInvasions.clear();
        liveGoals.clear();
        liveSyndicateMissions.clear();
        liveCalendarSeasons.clear();
        return;
    }

    if (refreshPromise) {
        return refreshPromise;
    }
    if (Date.now() - lastRefreshAttempt < REFRESH_INTERVAL_MS) {
        return;
    }

    lastRefreshAttempt = Date.now();
    refreshPromise = (async (): Promise<void> => {
        await Promise.all([restoreLiveInvasions(), restoreLiveGoals()]);
        await fetchLiveWorldState();
    })();
    try {
        await refreshPromise;
    } finally {
        refreshPromise = undefined;
    }
};

export const applyLiveWorldState = (worldState: IWorldState): void => {
    if (!config.worldState?.liveSync) {
        return;
    }

    const buildVersion = buildVersionToInt(worldState.BuildLabel);
    if (buildVersion < gameToBuildVersionInt["41.0.0"]) {
        return;
    }

    const localInvasions = [...liveInvasions.values()]
        .filter(entry => !activeInvasionIds || activeInvasionIds.has(entry.invasion._id.$oid ?? ""))
        .map(entry => structuredClone(entry.invasion));
    const localGoals = [...liveGoals.values()].map(entry => structuredClone(entry.goal));
    if (!cachedWorldState) {
        if (localGoals.length > 0) {
            worldState.Goals =
                buildVersion >= gameToBuildVersionInt["43.5.0"] ? localGoals : localGoals.filter(isUpdate41Goal);
        }
        if (localInvasions.length > 0) {
            worldState.Invasions = localInvasions;
        }
        return;
    }

    const liveWorldState = structuredClone(cachedWorldState);
    const compatibleSeasonInfo = getCompatibleSeasonInfo(liveWorldState.SeasonInfo, buildVersion);
    if (buildVersion >= gameToBuildVersionInt["44.0.0"]) {
        Object.assign(worldState, liveWorldState);
        worldState.Goals = localGoals;
        worldState.Invasions = localInvasions;
        return;
    }

    const compatibleConquests = liveWorldState.Conquests?.filter(isCompatibleConquest) ?? [];
    const conquestByType = new Map(compatibleConquests.map(conquest => [conquest.Type, conquest]));
    const liveLabConquest = conquestByType.get("CT_LAB");
    const liveHexConquest = conquestByType.get("CT_HEX");
    if (
        liveLabConquest &&
        liveHexConquest &&
        liveLabConquest.Activation.$date.$numberLong == liveHexConquest.Activation.$date.$numberLong &&
        liveLabConquest.Expiry.$date.$numberLong == liveHexConquest.Expiry.$date.$numberLong &&
        Number(liveLabConquest.Expiry.$date.$numberLong) > Date.now()
    ) {
        try {
            const tmp = JSON.parse(worldState.Tmp ?? "{}") as Record<string, unknown>;
            tmp.lqo = {
                mt: liveLabConquest.Missions.map(x => getMissionTypeForLegacyOverride(x.missionType, "CT_LAB")),
                mv: liveLabConquest.Missions.map(x => x.difficulties[1].deviation),
                c: liveLabConquest.Missions.map(x => x.difficulties[1].risks),
                fv: liveLabConquest.Variables
            };
            tmp.hqo = {
                mt: liveHexConquest.Missions.map(x => getMissionTypeForLegacyOverride(x.missionType, "CT_HEX")),
                mv: liveHexConquest.Missions.map(x => x.difficulties[1].deviation),
                mf: liveHexConquest.Missions.map(x => factionToInt(x.faction)),
                c: liveHexConquest.Missions.map(x => x.difficulties[1].risks),
                fv: liveHexConquest.Variables
            };
            worldState.Tmp = JSON.stringify(tmp);
            worldState.Conquests = [liveLabConquest, liveHexConquest];
        } catch {
            // Keep the locally generated legacy overrides if the local Tmp is malformed.
        }
    }

    if (liveWorldState.Tmp) {
        try {
            const liveTmp = JSON.parse(liveWorldState.Tmp) as Record<string, unknown>;
            const localTmp = JSON.parse(worldState.Tmp ?? "{}") as Record<string, unknown>;
            let changed = false;
            const pgr = liveTmp.pgr;
            if (
                pgr &&
                typeof pgr == "object" &&
                !Array.isArray(pgr) &&
                Object.values(pgr).every(value => typeof value == "string")
            ) {
                localTmp.pgr = pgr;
                changed = true;
            }
            const fbst = liveTmp.fbst;
            if (
                fbst &&
                typeof fbst == "object" &&
                "a" in fbst &&
                "e" in fbst &&
                "n" in fbst &&
                typeof fbst.a == "number" &&
                typeof fbst.e == "number" &&
                typeof fbst.n == "number"
            ) {
                localTmp.fbst = fbst;
                changed = true;
            }
            if (typeof liveTmp.sfn == "number") {
                localTmp.sfn = liveTmp.sfn;
                changed = true;
            }
            if (changed) {
                worldState.Tmp = JSON.stringify(localTmp);
            }
        } catch {
            // An invalid upstream Tmp should not replace the locally generated client overrides.
        }
    }

    const compatibleFissures = liveWorldState.ActiveMissions.filter(
        fissure =>
            isKnownNode(fissure.Node) &&
            (
                fissureMissions[fissure.Modifier as keyof typeof fissureMissions] as readonly string[] | undefined
            )?.includes(fissure.Node)
    );
    const compatibleStorms = liveWorldState.VoidStorms.filter(storm => isKnownNode(storm.Node));

    Object.assign(worldState, {
        Events: liveWorldState.Events,
        Goals: buildVersion >= gameToBuildVersionInt["43.5.0"] ? localGoals : localGoals.filter(isUpdate41Goal),
        Alerts: liveWorldState.Alerts.filter(alert => isKnownNode(alert.MissionInfo.location)),
        Sorties: liveWorldState.Sorties.filter(sortie => sortie.Variants.every(variant => isKnownNode(variant.node))),
        LiteSorties: liveWorldState.LiteSorties.filter(sortie =>
            sortie.Missions.every(mission => isKnownNode(mission.node))
        ),
        ActiveMissions:
            compatibleFissures.length || !liveWorldState.ActiveMissions.length
                ? compatibleFissures
                : worldState.ActiveMissions,
        ...(liveWorldState.Invasions ? { Invasions: localInvasions } : {}),
        ...(liveWorldState.SyndicateMissions
            ? {
                  SyndicateMissions: mergeSyndicateMissions(
                      worldState.SyndicateMissions,
                      liveWorldState.SyndicateMissions,
                      cachedBountyCycle?.expiry && cachedBountyCycle.expiry > Date.now() ? cachedBountyCycle : undefined
                  )
              }
            : {}),
        ...(liveWorldState.KnownCalendarSeasons
            ? {
                  KnownCalendarSeasons: liveWorldState.KnownCalendarSeasons.map(season =>
                      getCompatibleCalendarSeason(season, buildVersion)
                  ).filter((season): season is IWorldState["KnownCalendarSeasons"][number] => season !== undefined)
              }
            : {}),
        ...((): Partial<Pick<IWorldState, "Descents">> => {
            const compatibleDescents =
                liveWorldState.Descents?.filter(descent => isCompatibleDescent(descent, buildVersion)) ?? [];
            return compatibleDescents.length > 0 ? { Descents: compatibleDescents } : {};
        })(),
        ...((): Partial<Pick<IWorldState, "EndlessXpSchedule">> => {
            if (buildVersion < gameToBuildVersionInt["42.0.0"]) return {};
            const schedule =
                liveWorldState.EndlessXpSchedule?.filter(entry => isCompatibleEndlessXpSchedule(entry, buildVersion)) ??
                [];
            if (!schedule.length) return {};
            const lastExpiry = Math.max(...schedule.map(entry => Number(entry.Expiry.$date.$numberLong)));
            return {
                EndlessXpSchedule: [
                    ...schedule,
                    ...(worldState.EndlessXpSchedule ?? []).filter(
                        entry => Number(entry.Activation.$date.$numberLong) >= lastExpiry
                    )
                ]
            };
        })(),
        ...(compatibleSeasonInfo ? { SeasonInfo: compatibleSeasonInfo } : {}),
        VoidTraders: getCompatibleVoidTraders(liveWorldState.VoidTraders, buildVersion),
        VoidStorms:
            compatibleStorms.length || !liveWorldState.VoidStorms.length ? compatibleStorms : worldState.VoidStorms,
        DailyDeals: getCompatibleDailyDeals(liveWorldState.DailyDeals, buildVersion),
        ...(liveWorldState.PrimeVaultTraders
            ? {
                  PrimeVaultTraders: liveWorldState.PrimeVaultTraders.map(trader => ({
                      ...trader,
                      EvergreenManifest: worldState.PrimeVaultTraders[0]?.EvergreenManifest ?? [],
                      ScheduleInfo: getUpdate41PrimeVaultSchedule(trader)
                  }))
              }
            : {}),
        Conquests: worldState.Conquests
    });
};

export const getLiveGoalByOid = (oid: string, buildLabel: string): IWorldState["Goals"][number] | undefined => {
    if (!config.worldState?.liveSync) {
        return undefined;
    }
    const buildVersion = buildVersionToInt(buildLabel);
    if (buildVersion < gameToBuildVersionInt["41.0.0"]) {
        return undefined;
    }
    const goal = liveGoals.get(oid)?.goal;
    if (!goal || (buildVersion < gameToBuildVersionInt["43.5.0"] && !isUpdate41Goal(goal))) {
        return undefined;
    }
    return structuredClone(goal);
};

export const getLiveInvasionByOid = (oid: string): IWorldState["Invasions"][number] | undefined => {
    if (!config.worldState?.liveSync) {
        return undefined;
    }
    const invasion = liveInvasions.get(oid)?.invasion;
    return invasion ? structuredClone(invasion) : undefined;
};

export const getLiveSyndicateMissionByOid = (oid: string): IWorldState["SyndicateMissions"][number] | undefined => {
    if (!config.worldState?.liveSync) {
        return undefined;
    }
    const mission = liveSyndicateMissions.get(oid)?.mission;
    return mission ? structuredClone(mission) : undefined;
};

export const getLiveCalendarSeason = (activation: number): IWorldState["KnownCalendarSeasons"][number] | undefined => {
    if (!config.worldState?.liveSync) {
        return undefined;
    }
    const season = liveCalendarSeasons.get(activation);
    return season ? structuredClone(season) : undefined;
};

export const applyLiveTeshinRotation = (manifest: ICachedVendorManifest): ICachedVendorManifest => {
    if (!config.worldState?.liveSync) {
        return manifest;
    }

    const week = Math.trunc((Date.now() - teshinRotationEpoch) / unixTimesInMs.week);
    const weeklyOffer =
        teshinWeeklyOffers[
            ((week % teshinWeeklyOffers.length) + teshinWeeklyOffers.length) % teshinWeeklyOffers.length
        ];
    return {
        VendorInfo: {
            ...manifest.VendorInfo,
            ItemManifest: manifest.VendorInfo.ItemManifest.filter(
                offer =>
                    !offer.RotatedWeekly ||
                    offer.StoreItem == weeklyOffer ||
                    offer.StoreItem == "/Lotus/StoreItems/Types/Items/MiscItems/RivenIdentifier"
            )
        }
    };
};

export const getLiveDailyDealForPurchase = (
    storeItem: string,
    buildLabel: string
): IWorldState["DailyDeals"][number] | undefined => {
    if (!config.worldState?.liveSync || !cachedWorldState) {
        return undefined;
    }

    const buildVersion = buildVersionToInt(buildLabel);
    if (buildVersion < gameToBuildVersionInt["41.0.0"]) {
        return undefined;
    }
    return getCompatibleDailyDeals(cachedWorldState.DailyDeals, buildVersion).find(deal => deal.StoreItem == storeItem);
};

export const selfTestLiveWorldState = (): boolean => {
    const fakeSource = (freshnessMs: number): ISupplementalWorldState => ({
        freshnessMs,
        worldState: {} as ISupplementalWorldState["worldState"]
    });
    const date = (ms: number): { $date: { $numberLong: string } } => ({ $date: { $numberLong: String(ms) } });
    const local = {
        _id: { $oid: "000000000000000000000001" },
        Activation: date(0),
        Expiry: date(3000),
        Tag: "CetusSyndicate",
        Seed: 1,
        Nodes: [],
        Jobs: []
    } satisfies IWorldState["SyndicateMissions"][number];
    const official = { ...local, _id: { $oid: "000000000000000000000002" }, Expiry: date(2000), Seed: 2 };
    const next = { ...local, Activation: date(4000), Expiry: date(6000) };
    const merged = mergeSyndicateMissions(
        [local, next],
        [official],
        { expiry: 2000, bounties: { CetusSyndicate: [] } },
        1000
    );
    const oldBuild = gameToBuildVersionInt["42.0.0"];
    const u43 = gameToBuildVersionInt["43.5.4"];
    const circuit = { Activation: date(0), Expiry: date(3000), CategoryChoices: getEndlessXpChoices(650, u43) };
    const testPassed =
        newestSupplemental([fakeSource(1), fakeSource(2)]).freshnessMs == 2 &&
        merged.length == 2 &&
        merged[0].Seed == 1 &&
        merged[1].Seed == 2 &&
        mergeSyndicateMissions([local], [official], undefined, 1000)[0].Seed == 2 &&
        isCompatibleConquest(getConquest("CT_LAB", 650, null)) &&
        isCompatibleDescent(getDescent(650, u43), u43) &&
        isCompatibleDescent(getDescent(650, oldBuild), oldBuild) &&
        isCompatibleEndlessXpSchedule(circuit, u43) &&
        !isCompatibleEndlessXpSchedule(
            {
                ...circuit,
                CategoryChoices: [circuit.CategoryChoices[0], { Category: "EXC_HARD", Choices: ["U44Only"] }]
            },
            u43
        );
    if (!testPassed) {
        logger.warn("live world state self test failed");
    }
    return testPassed;
};
