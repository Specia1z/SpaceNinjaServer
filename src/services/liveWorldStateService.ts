import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";
import type { ILiveWorldActivityState, IWorldState } from "../types/worldStateTypes.ts";
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
import { LiveWorldActivityState } from "../models/worldStateModel.ts";

const LIVE_WORLD_STATE_URL = "https://oracle.browse.wf/worldState.min.json";
const SUPPLEMENTAL_WORLD_STATE_URLS = [
    "https://cdn.jsdelivr.net/gh/calamity-inc/warframe-worldstate-history@senpai/worldState.json?source=browse.wf",
    "https://api.warframe.com/cdn/worldState.php"
];
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
            logger.debug(`Could not supplement browse.wf world state with Prime Vault traders: ${String(e)}`);
        }
        const nextJson = JSON.stringify(liveWorldState);
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
        await restoreLiveInvasions();
        await fetchLiveWorldState();
    })();
    try {
        await refreshPromise;
    } finally {
        refreshPromise = undefined;
    }
};

export const applyLiveWorldState = (worldState: IWorldState): void => {
    if (!config.worldState?.liveSync || !cachedWorldState) {
        return;
    }

    const buildVersion = buildVersionToInt(worldState.BuildLabel);
    if (buildVersion < gameToBuildVersionInt["41.0.0"]) {
        return;
    }

    const liveWorldState = structuredClone(cachedWorldState);
    const compatibleSeasonInfo = getCompatibleSeasonInfo(liveWorldState.SeasonInfo, buildVersion);
    const localInvasions = [...liveInvasions.values()].map(entry => structuredClone(entry.invasion));
    if (buildVersion >= gameToBuildVersionInt["43.5.0"]) {
        Object.assign(worldState, liveWorldState);
        worldState.Invasions = localInvasions;
        return;
    }

    Object.assign(worldState, {
        Events: liveWorldState.Events,
        Goals: liveWorldState.Goals.filter(isUpdate41Goal),
        Alerts: liveWorldState.Alerts.filter(alert => isKnownNode(alert.MissionInfo.location)),
        Sorties: liveWorldState.Sorties.filter(sortie => sortie.Variants.every(variant => isKnownNode(variant.node))),
        LiteSorties: liveWorldState.LiteSorties.filter(sortie =>
            sortie.Missions.every(mission => isKnownNode(mission.node))
        ),
        ActiveMissions: liveWorldState.ActiveMissions.filter(fissure => isKnownNode(fissure.Node)),
        ...(liveWorldState.Invasions ? { Invasions: localInvasions } : {}),
        ...(liveWorldState.SyndicateMissions ? { SyndicateMissions: liveWorldState.SyndicateMissions } : {}),
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
