import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";
import type { ILiveGoalState, ILiveWorldActivityState, IWorldState } from "../types/worldStateTypes.ts";
import { buildVersionToInt } from "../helpers/versionHelper.ts";
import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";
import { sendWsBroadcastToGame } from "./wsService.ts";
import { ExportRegions, ExportSyndicates } from "warframe-public-export-plus";
import { isCompatibleDescent } from "./descentService.ts";
import baro from "../constants/baro.ts";
import darvoDeals from "../constants/darvoDeals.ts";
import type { ICachedVendorManifest } from "../types/vendorTypes.ts";
import { unixTimesInMs } from "../constants/timeConstants.ts";
import varzia from "../constants/varzia.ts";
import invasionNodes from "../../static/fixed_responses/worldState/invasionNodes.json" with { type: "json" };
import invasionRewards from "../../static/fixed_responses/worldState/invasionRewards.json" with { type: "json" };
import syndicateMissionNodes from "../../static/fixed_responses/worldState/syndicateMissions.json" with { type: "json" };
import { LiveGoalState, LiveWorldActivityState } from "../models/worldStateModel.ts";
import { fromMongoDate } from "../helpers/inventoryHelpers.ts";

const LIVE_WORLD_STATE_URL = "https://oracle.browse.wf/worldState.min.json";
const SUPPLEMENTAL_WORLD_STATE_URLS = [
    "https://cdn.jsdelivr.net/gh/calamity-inc/warframe-worldstate-history@senpai/worldState.json?source=browse.wf",
    "https://api.warframe.com/cdn/worldState.php"
];
const REFRESH_INTERVAL_MS = 60_000;
const MAX_SUPPLEMENTAL_AGE_SECONDS = 300;

export const isFreshSupplementalWorldState = (time: unknown, nowMs: number): boolean =>
    typeof time == "number" && Number.isFinite(time) && Math.abs(nowMs / 1000 - time) <= MAX_SUPPLEMENTAL_AGE_SECONDS;

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
            "PrimeVaultTraders" | "Invasions" | "SyndicateMissions" | "SeasonInfo" | "KnownCalendarSeasons" | "Descents"
        >
    >;

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
    return Object.fromEntries(liveWorldStateArrayKeys.map(key => [key, candidate[key]])) as Pick<
        IWorldState,
        TLiveWorldStateArrayKey
    >;
};

const isUpdate41Goal = (goal: IWorldState["Goals"][number]): boolean =>
    update41GoalTags.has(goal.Tag) || /^Anniversary\d+TacAlert(?:CM[A-Z])?$/.test(goal.Tag);

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

export const getActiveVoidTrader = (
    traders: IWorldState["VoidTraders"],
    nowMs: number = Date.now()
): IWorldState["VoidTraders"][number] | undefined =>
    traders.find(
        trader => fromMongoDate(trader.Activation).getTime() <= nowMs && fromMongoDate(trader.Expiry).getTime() > nowMs
    );

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

const getGoalDateMs = (date: IWorldState["Goals"][number]["Activation"]): number =>
    "$date" in date ? Number(date.$date.$numberLong) : date.sec * 1000 + Math.trunc(date.usec / 1000);

const getGoalOid = (goal: IWorldState["Goals"][number]): string => goal._id.$oid ?? goal._id.$id ?? "";

const getStaticGoalSnapshot = (
    goal: IWorldState["Goals"][number],
    stripProgress: boolean
): IWorldState["Goals"][number] => {
    const snapshot = structuredClone(goal);
    if (stripProgress) {
        delete snapshot.Count;
        delete snapshot.CountAlt;
        delete snapshot.HealthPct;
        delete snapshot.Success;
    }
    return snapshot;
};

const getGoalProgressMode = (goal: IWorldState["Goals"][number]): ILiveGoalState["progressMode"] => {
    const isCommunityGoal = ("Community" in goal && goal.Community) || !goal.Personal;
    if (
        (!isCommunityGoal && goal.Personal) ||
        (goal.Count === undefined && goal.CountAlt === undefined && goal.HealthPct === undefined)
    ) {
        return "none";
    }
    return goal.Fomorian ? "depletion" : "additive";
};

const getGoalProgressTarget = (goal: IWorldState["Goals"][number]): number => {
    const isCommunityGoal = ("Community" in goal && goal.Community) || !goal.Personal;
    if (!goal.Fomorian && isCommunityGoal && goal.Goal && goal.Goal > 0) {
        return goal.Goal;
    }
    return 100;
};

type TInitialLiveGoalProgress = Pick<
    ILiveGoalState,
    "count" | "countAlt" | "healthPct" | "success" | "status" | "initialProgressSource"
> & { completed: boolean };

const clampGoalProgress = (value: number, target: number): number => Math.min(target, Math.max(0, value));

export const getInitialLiveGoalProgress = (
    goal: IWorldState["Goals"][number],
    progressMode: ILiveGoalState["progressMode"],
    target: number
): TInitialLiveGoalProgress => {
    if (progressMode == "none") {
        return {
            count: 0,
            countAlt: 0,
            healthPct: 0,
            success: 0,
            status: "active",
            completed: false,
            initialProgressSource: "zero"
        };
    }

    const officialCount = goal.Count;
    const officialHealthPct = goal.HealthPct;
    const hasOfficialCount = officialCount !== undefined && Number.isFinite(officialCount);
    const hasOfficialHealthPct = officialHealthPct !== undefined && Number.isFinite(officialHealthPct);
    const count = hasOfficialCount
        ? clampGoalProgress(officialCount, target)
        : hasOfficialHealthPct
          ? clampGoalProgress(
                (progressMode == "depletion" ? 1 - officialHealthPct : officialHealthPct) * target,
                target
            )
          : 0;
    const countAlt =
        goal.CountAlt !== undefined && Number.isFinite(goal.CountAlt) ? clampGoalProgress(goal.CountAlt, target) : 0;
    const healthPct = progressMode == "depletion" ? 1 - count / target : count / target;
    const hasOfficialCountAlt = goal.CountAlt !== undefined && Number.isFinite(goal.CountAlt);
    const hasOfficialProgress = hasOfficialCount || hasOfficialCountAlt || hasOfficialHealthPct;
    const officialSuccess = goal.Success;
    const success = Math.max(
        officialSuccess !== undefined && Number.isFinite(officialSuccess)
            ? Math.min(1, Math.max(0, officialSuccess))
            : 0,
        count >= target ? 1 : 0
    );
    const completed = count >= target || success > 0;

    return {
        count,
        countAlt,
        healthPct,
        success,
        status: completed ? "completed" : "active",
        completed,
        initialProgressSource: hasOfficialProgress ? "official" : "zero"
    };
};

const getLocalInvasion = (state: ILiveWorldActivityState): IWorldState["Invasions"][number] => ({
    ...structuredClone(state.snapshot),
    Count: state.localCount,
    Goal: state.goal,
    Completed: state.status == "completed" || Math.abs(state.localCount) >= state.goal
});

export const mergeLocalInvasionProgress = (localCount: number, officialCount: number | undefined): number => {
    const local = Number.isFinite(localCount) ? localCount : 0;
    if (officialCount === undefined || !Number.isFinite(officialCount)) {
        return local;
    }
    return Math.abs(officialCount) > Math.abs(local) ? officialCount : local;
};

export const isLiveInvasionCompleted = (localCount: number, goal: number, officialCompleted = false): boolean =>
    officialCompleted || (Number.isFinite(goal) && goal > 0 && Math.abs(localCount) >= goal);

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

const updateCachedLiveGoal = (state: ILiveGoalState): void => {
    const goal = getLocalGoal(state);
    const current = liveGoals.get(state.officialId);
    const currentCount = current?.goal.Count;
    const nextCount = goal.Count;
    if (
        current &&
        current.activationMs == state.activationMs &&
        currentCount !== undefined &&
        nextCount !== undefined
    ) {
        // Concurrent uploads can return from MongoDB out of order. Never expose an older count.
        if (nextCount < currentCount) {
            return;
        }
    }
    liveGoals.set(state.officialId, { goal, activationMs: state.activationMs });
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
            const officialExpiryMs = getGoalDateMs(goal.Expiry);
            const existingState = (await LiveGoalState.findOne({ officialId, activationMs }).lean()) as
                | (Partial<ILiveGoalState> & Pick<ILiveGoalState, "officialId" | "activationMs">)
                | null;
            const target = existingState?.target ?? getGoalProgressTarget(goal);
            const effectiveProgressMode =
                existingState?.progressMode && existingState.progressMode != "none"
                    ? existingState.progressMode
                    : progressMode;
            const hasCount =
                Boolean(existingState?.hasCount) || (effectiveProgressMode != "none" && goal.Count !== undefined);
            const hasCountAlt =
                Boolean(existingState?.hasCountAlt) || (effectiveProgressMode != "none" && goal.CountAlt !== undefined);
            const hasHealthPct =
                Boolean(existingState?.hasHealthPct) ||
                (effectiveProgressMode != "none" && goal.HealthPct !== undefined);
            const hasSuccess =
                Boolean(existingState?.hasSuccess) || (effectiveProgressMode != "none" && goal.Success !== undefined);
            const initialProgress = getInitialLiveGoalProgress(goal, effectiveProgressMode, target);
            const count = Math.max(existingState?.count ?? 0, initialProgress.count);
            const countAlt = Math.max(existingState?.countAlt ?? 0, initialProgress.countAlt);
            const success = Math.max(existingState?.success ?? 0, initialProgress.success);
            const healthPct = hasHealthPct
                ? target > 0
                    ? effectiveProgressMode == "depletion"
                        ? Math.max(0, Math.min(1, 1 - count / target))
                        : Math.max(0, Math.min(1, count / target))
                    : initialProgress.healthPct
                : (existingState?.healthPct ?? initialProgress.healthPct);
            const completed =
                existingState?.status == "completed" || initialProgress.completed || count >= target || success > 0;
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
                        snapshot: getStaticGoalSnapshot(goal, effectiveProgressMode != "none"),
                        target,
                        progressMode: effectiveProgressMode,
                        hasCount,
                        hasCountAlt,
                        hasHealthPct,
                        hasSuccess,
                        count,
                        countAlt,
                        healthPct,
                        success,
                        status: completed ? "completed" : "active",
                        lastSeenAt: now
                    },
                    $setOnInsert: {
                        officialId,
                        activationMs,
                        count: initialProgress.count,
                        countAlt: initialProgress.countAlt,
                        healthPct: initialProgress.healthPct,
                        success: initialProgress.success,
                        status: initialProgress.status,
                        ...(existingState
                            ? {}
                            : {
                                  progressInitialized: true,
                                  initialProgressSource: initialProgress.initialProgressSource
                              }),
                        ...(completed
                            ? { completedAt: now, expiresAt: new Date(now.getTime() + 30 * unixTimesInMs.day) }
                            : { expiresAt })
                    }
                },
                { upsert: true }
            );
            if (
                existingState &&
                (existingState.progressInitialized === undefined || existingState.initialProgressSource === undefined)
            ) {
                await LiveGoalState.updateOne(
                    { officialId, activationMs },
                    {
                        $set: {
                            ...(existingState.progressInitialized === undefined ? { progressInitialized: true } : {}),
                            ...(existingState.initialProgressSource === undefined
                                ? { initialProgressSource: "local" }
                                : {})
                        }
                    }
                );
            }
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

    updateCachedLiveGoal(state.toObject() as ILiveGoalState);
    sendWsBroadcastToGame(undefined, { sync_world_state: true });
};

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
            const existingState = await LiveWorldActivityState.findOne({ type: "invasion", officialId }).lean();
            const localCount = mergeLocalInvasionProgress(existingState?.localCount ?? 0, invasion.Count);
            const completed =
                existingState?.status == "completed" ||
                isLiveInvasionCompleted(localCount, invasion.Goal, invasion.Completed);
            await LiveWorldActivityState.findOneAndUpdate(
                { type: "invasion", officialId },
                {
                    $set: {
                        snapshot: invasion,
                        goal: invasion.Goal,
                        localCount,
                        status: completed ? "completed" : "active",
                        lastSeenAt: now,
                        expiresAt: expiry,
                        ...(completed && !existingState?.completedAt ? { completedAt: now } : {})
                    },
                    $setOnInsert: {
                        type: "invasion",
                        officialId
                    }
                },
                { upsert: true }
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

    const completed = isLiveInvasionCompleted(state.localCount, state.goal);
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

export const mergeCurrentSyndicateMissions = (
    generated: IWorldState["SyndicateMissions"],
    live: IWorldState["SyndicateMissions"] | undefined,
    nowMs: number
): IWorldState["SyndicateMissions"] => {
    if (!live) {
        return generated;
    }
    const current = live.filter(mission => fromMongoDate(mission.Expiry).getTime() > nowMs);
    const activeTags = new Set(
        current.filter(mission => fromMongoDate(mission.Activation).getTime() <= nowMs).map(mission => mission.Tag)
    );
    const liveTags = new Set(current.map(mission => mission.Tag));
    return [
        ...generated.filter(
            mission =>
                !activeTags.has(mission.Tag) &&
                (!liveTags.has(mission.Tag) || fromMongoDate(mission.Activation).getTime() <= nowMs)
        ),
        ...current
    ];
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

export const mergeLocalGoalProgress = (
    generatedGoals: IWorldState["Goals"],
    liveGoals: IWorldState["Goals"],
    persistedGoals: IWorldState["Goals"],
    buildVersion: number
): IWorldState["Goals"] => {
    const isCompatibleGoal = (goal: IWorldState["Goals"][number]): boolean =>
        buildVersion >= gameToBuildVersionInt["43.5.0"] || isUpdate41Goal(goal);
    const isSameActivity = (a: IWorldState["Goals"][number], b: IWorldState["Goals"][number]): boolean => {
        const aStart = getGoalDateMs(a.Activation);
        const aEnd = getGoalDateMs(a.Expiry);
        const bStart = getGoalDateMs(b.Activation);
        const bEnd = getGoalDateMs(b.Expiry);
        return (
            a.Tag == b.Tag &&
            a.Desc == b.Desc &&
            a.Node == b.Node &&
            a.MissionKeyName == b.MissionKeyName &&
            a.Personal == b.Personal &&
            a.Best == b.Best &&
            Number.isFinite(aStart) &&
            Number.isFinite(aEnd) &&
            Number.isFinite(bStart) &&
            Number.isFinite(bEnd) &&
            aStart < bEnd &&
            bStart < aEnd
        );
    };
    const syncedGoals = [...liveGoals, ...persistedGoals].filter(isCompatibleGoal);
    const result = structuredClone(
        generatedGoals.filter(
            goal => isCompatibleGoal(goal) && !syncedGoals.some(synced => isSameActivity(goal, synced))
        )
    ) as IWorldState["Goals"];
    const resultIndexes = new Map<string, number>();
    result.forEach((goal, index) => {
        const oid = getGoalOid(goal);
        if (oid) {
            resultIndexes.set(oid, index);
        }
    });

    const persistedByOid = new Map<string, IWorldState["Goals"][number]>();
    for (const goal of persistedGoals) {
        const oid = getGoalOid(goal);
        if (oid) {
            persistedByOid.set(oid, goal);
        }
    }

    const mergePersistedProgress = (
        officialGoal: IWorldState["Goals"][number],
        persistedGoal: IWorldState["Goals"][number]
    ): IWorldState["Goals"][number] => {
        const merged = structuredClone(officialGoal) as IWorldState["Goals"][number];
        for (const key of ["Count", "CountAlt", "HealthPct", "Success"] as const) {
            if (key in persistedGoal) {
                (merged as unknown as Record<string, unknown>)[key] = persistedGoal[key];
            }
        }
        return merged;
    };

    const mergeGoal = (goal: IWorldState["Goals"][number]): void => {
        if (buildVersion < gameToBuildVersionInt["43.5.0"] && !isUpdate41Goal(goal)) {
            return;
        }
        const oid = getGoalOid(goal);
        if (!oid) {
            result.push(structuredClone(goal));
            return;
        }
        const index = resultIndexes.get(oid);
        if (index === undefined) {
            resultIndexes.set(oid, result.length);
            result.push(structuredClone(goal));
        } else {
            result[index] = structuredClone(goal);
        }
    };

    for (const goal of liveGoals) {
        const oid = getGoalOid(goal);
        const persisted = oid ? persistedByOid.get(oid) : undefined;
        mergeGoal(persisted ? mergePersistedProgress(goal, persisted) : goal);
    }

    // Keep a locally persisted activity visible when the upstream snapshot temporarily omits it.
    const liveGoalOids = new Set(liveGoals.map(getGoalOid).filter(Boolean));
    for (const goal of persistedGoals) {
        const oid = getGoalOid(goal);
        if (!oid || !liveGoalOids.has(oid)) {
            mergeGoal(goal);
        }
    }
    return result;
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

const fetchSupplementalWorldState = async (): Promise<
    Pick<
        IWorldState,
        "PrimeVaultTraders" | "Invasions" | "SyndicateMissions" | "SeasonInfo" | "KnownCalendarSeasons" | "Descents"
    >
> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
        return await Promise.any(
            SUPPLEMENTAL_WORLD_STATE_URLS.map(async url => {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`${url}: HTTP ${response.status}`);
                }
                const worldState = (await response.json()) as Partial<IWorldState>;
                if (
                    !Array.isArray(worldState.PrimeVaultTraders) ||
                    !Array.isArray(worldState.Invasions) ||
                    !Array.isArray(worldState.SyndicateMissions) ||
                    !Array.isArray(worldState.KnownCalendarSeasons) ||
                    !worldState.SeasonInfo
                ) {
                    throw new Error(`${url}: supplemental world state fields are missing`);
                }
                if (!isFreshSupplementalWorldState(worldState.Time, Date.now())) {
                    throw new Error(`${url}: supplemental world state is stale`);
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
                    PrimeVaultTraders: primeVaultTraders,
                    Invasions: invasions,
                    SyndicateMissions: syndicateMissions,
                    SeasonInfo: worldState.SeasonInfo,
                    KnownCalendarSeasons: knownCalendarSeasons,
                    Descents: worldState.Descents ?? []
                };
            })
        );
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
        try {
            await updateLiveGoals(liveWorldState.Goals);
        } catch (e) {
            logger.debug(`Could not persist live goal state: ${String(e)}`);
        }
        try {
            const supplementalWorldState = await fetchSupplementalWorldState();
            liveWorldState.PrimeVaultTraders = supplementalWorldState.PrimeVaultTraders;
            liveWorldState.Invasions = supplementalWorldState.Invasions;
            liveWorldState.SyndicateMissions = supplementalWorldState.SyndicateMissions;
            liveWorldState.SeasonInfo = supplementalWorldState.SeasonInfo;
            liveWorldState.KnownCalendarSeasons = supplementalWorldState.KnownCalendarSeasons;
            liveWorldState.Descents = supplementalWorldState.Descents;
            await updateLiveInvasions(supplementalWorldState.Invasions);
            updateLiveSyndicateMissions(supplementalWorldState.SyndicateMissions);
            updateLiveCalendarSeasons(supplementalWorldState.KnownCalendarSeasons);
        } catch (e) {
            logger.debug(`Could not supplement browse.wf world state: ${String(e)}`);
        }
        const nextJson = JSON.stringify({
            ...liveWorldState,
            Goals: liveWorldState.Goals.map(goal => getStaticGoalSnapshot(goal, true))
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

    const localGoals = [...liveGoals.values()].map(entry => structuredClone(entry.goal));
    if (!cachedWorldState) {
        if (localGoals.length > 0) {
            worldState.Goals = mergeLocalGoalProgress(worldState.Goals, [], localGoals, buildVersion);
        }
        return;
    }

    const liveWorldState = structuredClone(cachedWorldState);
    const compatibleSeasonInfo = getCompatibleSeasonInfo(liveWorldState.SeasonInfo, buildVersion);
    const localInvasions = [...liveInvasions.values()].map(entry => structuredClone(entry.invasion));
    const mergedGoals = mergeLocalGoalProgress(worldState.Goals, liveWorldState.Goals, localGoals, buildVersion);
    const syndicateMissions = mergeCurrentSyndicateMissions(
        worldState.SyndicateMissions,
        liveWorldState.SyndicateMissions,
        Date.now()
    );
    if (buildVersion >= gameToBuildVersionInt["43.5.0"]) {
        Object.assign(worldState, liveWorldState);
        worldState.Goals = mergedGoals;
        worldState.Invasions = localInvasions;
        worldState.SyndicateMissions = syndicateMissions;
        return;
    }

    Object.assign(worldState, {
        Events: liveWorldState.Events,
        Goals: mergedGoals,
        Alerts: liveWorldState.Alerts.filter(alert => isKnownNode(alert.MissionInfo.location)),
        Sorties: liveWorldState.Sorties.filter(sortie => sortie.Variants.every(variant => isKnownNode(variant.node))),
        LiteSorties: liveWorldState.LiteSorties.filter(sortie =>
            sortie.Missions.every(mission => isKnownNode(mission.node))
        ),
        ActiveMissions: liveWorldState.ActiveMissions.filter(fissure => isKnownNode(fissure.Node)),
        ...(liveWorldState.Invasions ? { Invasions: localInvasions } : {}),
        SyndicateMissions: syndicateMissions,
        ...(liveWorldState.KnownCalendarSeasons
            ? {
                  KnownCalendarSeasons: liveWorldState.KnownCalendarSeasons.map(season =>
                      getCompatibleCalendarSeason(season, buildVersion)
                  ).filter((season): season is IWorldState["KnownCalendarSeasons"][number] => season !== undefined)
              }
            : {}),
        ...((): Partial<Pick<IWorldState, "Descents">> => {
            const compatibleDescents = liveWorldState.Descents?.filter(isCompatibleDescent) ?? [];
            return compatibleDescents.length > 0 ? { Descents: compatibleDescents } : {};
        })(),
        ...(compatibleSeasonInfo ? { SeasonInfo: compatibleSeasonInfo } : {}),
        VoidTraders: getCompatibleVoidTraders(liveWorldState.VoidTraders, buildVersion),
        VoidStorms: liveWorldState.VoidStorms.filter(storm => isKnownNode(storm.Node)),
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
        Conquests: liveWorldState.Conquests
    });
};

export const getLiveInvasionByOid = (oid: string): IWorldState["Invasions"][number] | undefined => {
    if (!config.worldState?.liveSync) {
        return undefined;
    }
    const invasion = liveInvasions.get(oid)?.invasion;
    return invasion ? structuredClone(invasion) : undefined;
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
