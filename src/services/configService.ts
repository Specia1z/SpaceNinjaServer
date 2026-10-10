import fs from "fs";
import path from "path";
import { repoDir } from "../helpers/pathHelper.ts";
import { args } from "../helpers/commandLineArguments.ts";
import type { Request } from "express";
import { version_compare } from "../helpers/inventoryHelpers.ts";
import configDefaults from "../../config-vanilla.json" with { type: "json" };
import type { IAccountCheats } from "../types/inventoryTypes/inventoryTypes.ts";

export type TRegionId = "ASIA" | "OCEANIA" | "EUROPE" | "RUSSIA" | "NORTH_AMERICA" | "SOUTH_AMERICA";

export interface IHubServer {
    address: string;
    regions?: TRegionId[];
    dtlsUnsupported?: boolean;
    portPoolSize?: number;
}

export interface IWebuiConfig {
    enabled?: boolean;
    adminOnly?: boolean;
    defaultLanguage?: string;
    nonAdminPermissions?: Record<string, boolean | Record<string, boolean>>;
}

export interface IPlayerPortalConfig {
    enabled?: boolean;
    registrationEnabled?: boolean;
    renameEnabled?: boolean;
    firstRenameEnabled?: boolean;
    renameCost?: number;
    renameCooldownDays?: number;
    referralsEnabled?: boolean;
    inviterReward?: number;
    inviteeReward?: number;
    maxReferralsPerAccount?: number;
    referralRequiredOnlineMinutes?: number;
    milestoneEvery?: number;
    milestoneBonus?: number;
}

export interface IPlayerMarketItemOverride {
    displayName?: string;
    unitSize?: number;
    basePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    initialStock?: number;
    enabled?: boolean;
}

export interface IPlayerMarketConfig {
    enabled?: boolean;
    buyEnabled?: boolean;
    sellEnabled?: boolean;
    accountDailyPlatinumCap?: number;
    accountDailyTransactionLimit?: number;
    accountDailyQuantityCap?: number;
    globalDailyMintCap?: number;
    globalDailyTransactionLimit?: number;
    globalDailyQuantityCap?: number;
    priceSpreadPercent?: number;
    priceChangeLimitPercent?: number;
    minimumAccountAgeHours?: number;
    excludedItemPatterns?: string[];
    itemOverrides?: Record<string, IPlayerMarketItemOverride>;
}

export interface IMetadataPatchConfig {
    name?: string;
    enabled?: boolean;
    /** Complete Metadata Patch DSL block. */
    text?: string;
    /** Legacy structured fields retained for automatic migration. */
    targets?: string[];
    operations?: string[];
}

/** Public defaults consumed by the PlayWF client before account login. */
export interface IClientConfig {
    fallback_language?: string;
    fallback_languageVO?: string;
    fallback_graphicsDriver?: string;
    fallback_windowMode?: number;
    fallback_cluster?: string;
    language?: string;
    server_host?: string;
    http_port?: number;
    https_port?: number;
    secure_connections?: boolean;
    high_damage_numbers_patch?: boolean;
    skip_mission_start_timer?: boolean;
    disable_profanity_filter?: boolean;
    logout_on_request_failure?: boolean;
    fov_override?: number;
    simulacrum_blacklisted?: boolean;
    simulacrum_whitelisted?: boolean;
    pause_always_stops_time?: boolean;
    disable_firewall_prompt?: boolean;
    ee_log_in_console?: boolean;
    alternative_loading?: boolean;
    save_all_metadata?: boolean;
    write_all_metadata_reads_to_console?: boolean;
    write_all_metadata_reads_to_ee_log?: boolean;
    write_patched_metadata_reads_to_console?: boolean;
    write_patched_metadata_reads_to_ee_log?: boolean;
    client_http_logging?: boolean;
    disable_overlay?: boolean;
    overlay_compatibility_mode?: boolean;
    keep_console_open?: boolean;
}

export interface IAccountDropMultiplier {
    /** Per-account pickup amount on modern clients; final-settlement fallback for legacy clients. */
    resourceMultiplier?: number;
    /** Multiplier for mod drops reported in StrippedItems.DROP_MOD. */
    modMultiplier?: number;
}

export interface IAccountRateProfile {
    enabled?: boolean;
    /** Optional ISO 8601 date-time with a timezone; expired profiles apply no bonus. */
    expiresAt?: string;
    resourceDropMultiplier?: number;
    modDropMultiplier?: number;
    creditMultiplier?: number;
    /** Client-side Warframe/weapon affinity (distinct from Focus XP). */
    affinityMultiplier?: number;
    focusXpMultiplier?: number;
    standingMultiplier?: number;
    nightwaveStandingMultiplier?: number;
    relicRewardMultiplier?: number;
    relicPlatinumMultiplier?: number;
    missionPlatinumMultiplier?: number;
    dailyTributeMultiplier?: number;
}

export type TWorldStateBoostMultiplierKey =
    | "creditBoostMultiplier"
    | "affinityBoostMultiplier"
    | "resourceBoostMultiplier";

export type TVarziaRotationMode = "daily" | "weekly" | "monthly" | "custom";

const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const isValidIsoDateTime = (value: unknown): value is string =>
    typeof value == "string" && isoDateTimePattern.test(value) && Number.isFinite(Date.parse(value));

export const isWorldStateBoostActive = (now = Date.now()): boolean => {
    const expiresAt = config.worldState?.boostExpiresAt;
    return expiresAt === undefined || expiresAt === null || expiresAt === ""
        ? true
        : isValidIsoDateTime(expiresAt) && now < Date.parse(expiresAt);
};

export const getWorldStateBoostMultiplier = (key: TWorldStateBoostMultiplierKey): number | undefined => {
    const multiplier = config.worldState?.[key];
    return isWorldStateBoostActive() && multiplier ? multiplier : undefined;
};

export type TLogLevel = "error" | "warn" | "info" | "http" | "debug" | "trace";

type TQolConfigKey =
    | "tutorialGivesStanceMods"
    | "twentythreeHourMasteryRankCooldown"
    | "doubleDailySynthesisEndoReward"
    | "tylRegorDropsTwoEquinoxParts"
    | "railjackExtraResourceBundlesReward"
    | "railjackSteelEssencesReward";

export interface IConfig {
    /** @deprecated */ mongodbUrl?: string;
    database:
        | string
        | {
              engine: "MongoDB 7.0" | "MongoDB 8.0";
              dbPath: string;
          };
    logger: {
        files: boolean;
        /** @deprecated */ level?: TLogLevel;
        fileLevel?: TLogLevel;
        consoleLevel?: TLogLevel;
        format?: string;
    };
    myAddress: string;
    bindAddress?: string;
    httpPort?: number;
    httpsPort?: number;
    httpsCertFile?: string;
    httpsKeyFile?: string;
    builtinIrcEnabled?: boolean;
    builtinIrcPorts?: number[];
    ircExecutable?: string;
    ircAddress?: string;
    /** Internal IRC management URL (not the public chat address). */
    ircManagementUrl?: string;
    hubExecutable?: string;
    udpRelayBindAddress?: string;
    udpRelayPort?: number;
    udpRelayPortPoolSize?: number;
    udpRelayTarget?: string;
    udpRelayIdleTimeoutMs?: number;
    /** @deprecated */ hubAddress?: string;
    hubServers?: IHubServer[];
    noHubDiscrimination?: boolean;
    /** @deprecated */ nrsAddress?: string;
    nrsAddresses?: string[];
    dtls?: number;
    administratorNames?: string[];
    autoCreateAccount?: boolean;
    /** Server-wide values for the controls formerly stored per account in Inventory. */
    accountCheats?: Partial<IAccountCheats>;
    playerPortal?: IPlayerPortalConfig;
    playerMarket?: IPlayerMarketConfig;
    registrationRateLimit?: {
        /** Rolling time window for new accounts, in minutes (default: 1440). */
        windowMinutes?: number;
        /** Registration attempts per client address (default: 3). */
        perAddress?: number;
        /** Successful or pending registrations across the server (default: 100). */
        global?: number;
        /** All registration attempts across the server, including failed writes (default: 1000). */
        globalAttempts?: number;
        /** Exact reverse-proxy IP addresses allowed to supply X-Forwarded-For. */
        trustedProxies?: string[];
    };
    fallbackBuildLabel?: string;
    skipTutorial?: boolean;
    fullyStockedVendors?: boolean;
    skipClanKeyCrafting?: boolean;
    infiniteHelminthMaterials?: boolean;
    universalPolarityEverywhere?: boolean;
    unlockDoubleCapacityPotatoesEverywhere?: boolean;
    unlockExilusEverywhere?: boolean;
    unlockArcanesEverywhere?: boolean;
    missionAyaRewardMin?: number;
    missionAyaRewardMax?: number;
    /** Chance, in percent, that a successful mission awards Aya. */
    missionAyaRewardChance?: number;
    /** Maximum Aya granted by mission rewards per UTC day. */
    missionAyaRewardDailyCap?: number;
    /** Successful mission completions needed for a guaranteed Aya drop. 0 disables the pity rule. */
    missionAyaRewardPityCompletions?: number;
    missionPlatinumRewardMin?: number;
    missionPlatinumRewardMax?: number;
    /** Chance, in percent, that a completed mission awards the platinum reward at all. Undefined or 100 means always. */
    missionPlatinumRewardChance?: number;
    /** Maximum platinum granted by mission rewards per UTC day. */
    missionPlatinumRewardDailyCap?: number;
    /** Successful mission completions needed for a guaranteed platinum drop. 0 disables the pity rule. */
    missionPlatinumRewardPityCompletions?: number;
    /** When true, the platinum reward is delivered as an Ordis inbox message instead of being credited silently. */
    missionPlatinumRewardSendMail?: boolean;
    /** Per-account mission drop multipliers, keyed by the exact DisplayName. */
    accountDropMultipliers?: Record<string, IAccountDropMultiplier>;
    /** Per-account reward multipliers, keyed by the MongoDB account id. */
    accountRateProfiles?: Record<string, IAccountRateProfile>;
    relicPlatinumReward?: {
        common?: number;
        uncommon?: number;
        rare?: number;
    };
    /** @deprecated Use the two independent new-account options below. */
    autoCompleteQuestsAndUnlockMissions?: boolean;
    autoCompleteQuestsForNewAccounts?: boolean;
    /** Unlocks the star chart for new accounts and retroactively applies it to existing accounts when enabled. */
    unlockAllMissionsForNewAccounts?: boolean;
    newAccountStarterPack?: boolean;
    noMasteryRankUpCooldown?: boolean;
    /**
     * 结算上行报文的作弊检测。只覆盖「会过网络」的手法：透视、无敌、无限弹药这类纯本地改动
     * 不产生上行数据，服务端无从取证。
     */
    antiCheat?: {
        /** 总开关。关闭后完全不跑检测。 */
        enabled?: boolean;
        /**
         * 是否实际拦截。默认 false 只记日志，玩家照常拿到奖励；打开后命中会改写结算种子、
         * 拒绝发放任务奖励。
         */
        enforce?: boolean;
        /** 结算上报为成功的任务，时长低于该值即判定异常（秒）。0 表示不检查。 */
        minMissionTimeSec?: number;
        /** 单次结算允许计入的任务完成次数上限。0 表示不限制。 */
        maxMissionCompletesPerReport?: number;
        /** 单位任务时长允许的装备经验上限（经验/秒）。0 表示不检查。 */
        maxXpPerMissionSecond?: number;
        /** 客户端单次结算对同一物品允许上报的最大数量。0 表示不检查。 */
        maxClientItemCountPerReport?: number;
    };
    webui?: IWebuiConfig;
    client?: IClientConfig;
    unfaithfulBugFixes?: {
        ignore1999LastRegionPlayed?: boolean;
        fixXtraCheeseTimer?: boolean;
        useAnniversaryTagForOldGoals?: boolean;
        giveBreedingGroundsRewardsAtSum?: boolean;
    };
    worldState?: {
        liveSync?: boolean;
        creditBoostMultiplier?: number;
        affinityBoostMultiplier?: number;
        resourceBoostMultiplier?: number;
        /** Shared ISO 8601 expiry for the three global reward multipliers. */
        boostExpiresAt?: string | null;
        tennoLiveRelay?: boolean;
        baroTennoConRelay?: boolean;
        baroAlwaysAvailable?: boolean;
        baroFullyStocked?: boolean;
        baroRelayOverride?: number;
        evilBaroStage?: number;
        varziaFullyStocked?: boolean;
        varziaCustomRotationEnabled?: boolean;
        varziaCustomRotationMode?: TVarziaRotationMode;
        varziaCustomRotationDays?: number;
        vanguardVaultRelics?: boolean;
        wolfHunt?: number;
        scarletSpear?: boolean;
        orphixVenom?: boolean;
        bloodOfPerita?: boolean;
        longShadow?: boolean;
        hallowedFlame?: boolean;
        anniversary?: number;
        hallowedNightmares?: boolean;
        hallowedNightmaresRewardsOverride?: number;
        naberusNightsOverride?: boolean;
        proxyRebellion?: boolean;
        proxyRebellionRewardsOverride?: number;
        voidCorruption2025Week1?: boolean;
        voidCorruption2025Week2?: boolean;
        voidCorruption2025Week3?: boolean;
        voidCorruption2025Week4?: boolean;
        dagathAlerts2026Week1?: boolean;
        dagathAlerts2026Week2?: boolean;
        dagathAlerts2026Week3?: boolean;
        dagathAlerts2026Week4?: boolean;
        starDaysAlerts2026Week1?: boolean;
        starDaysAlerts2026Week2?: boolean;
        starDaysAlerts2026Week3?: boolean;
        starDaysAlerts2026Week4?: boolean;
        qtccAlerts?: boolean;
        destiny2TributeAlert?: boolean;
        galleonOfGhouls?: number;
        ghoulEmergenceOverride?: boolean;
        plagueStarOverride?: boolean;
        starDaysOverride?: boolean;
        saintPatrickOverride?: boolean;
        prideOverride?: boolean;
        xmasOverride?: boolean;
        lunarNewYear?: string;
        dogDaysOverride?: boolean;
        dogDaysRewardsOverride?: number;
        operationAtramentum?: boolean;
        operationAtramentumProgressOverride?: number;
        bellyOfTheBeast?: boolean;
        bellyOfTheBeastProgressOverride?: number;
        eightClaw?: boolean;
        eightClawProgressOverride?: number;
        thermiaFracturesOverride?: boolean;
        thermiaFracturesProgressOverride?: number;
        eidolonOverride?: string;
        vallisOverride?: string;
        duviriOverride?: string;
        nightwaveOverride?: string;
        nightwaveEpisode?: number;
        classicAlerts?: boolean;
        allTheFissures?: string;
        varziaOverride?: string;
        circuitGameModes?: string[];
        darvoStockMultiplier?: number;
        communitySynthesisTarget?: number;
        communitySynthesisProgress?: number;
        snowdayShowdown?: boolean;
        breedingGrounds?: boolean;
    };
    serversideQualityOfLife?: Record<TQolConfigKey, boolean | null>;
    inventoryDefaults?: Record<string, any>;
    tunables?: {
        useLoginToken?: boolean;
        prohibitSkipMissionStartTimer?: boolean;
        prohibitDisableProfanityFilter?: boolean;
        prohibitFovOverride?: boolean;
        prohibitFreecam?: boolean;
        prohibitTeleport?: boolean;
        prohibitScripts?: boolean;
        prohibitLocalMetadataPatches?: boolean;
        motd?: string;
        udpProxyUpstream?: string;
        forceNativeProxy?: boolean;
        /** Exact Warframe build label accepted by the bootstrapper. Undefined disables the check. */
        requiredBuildLabel?: string | null;
        versionMismatchTitle?: string | null;
        versionMismatchMessage?: string | null;
        metadataPatches?: IMetadataPatchConfig[];
        /** Metadata patches appended after the global patches for a matching account ID. */
        accountMetadataPatches?: Partial<Record<string, IMetadataPatchConfig[]>>;
    };
    dev?: {
        keepVendorsExpired?: boolean;
    };
}

export const inventoryAffectingConfigKeys = [
    "infiniteHelminthMaterials",
    "universalPolarityEverywhere",
    "unlockDoubleCapacityPotatoesEverywhere",
    "unlockExilusEverywhere",
    "unlockArcanesEverywhere"
] as const;

export const configRemovedOptionsKeys = [
    "unlockallShipFeatures",
    "testQuestKey",
    "lockTime",
    "starDays",
    "platformCDNs",
    "completeAllQuests",
    "worldSeed",
    "unlockAllQuests",
    "unlockAllMissions",
    "version",
    "matchmakingBuildId",
    "buildLabel",
    "infiniteResources",
    "testMission",
    "skipStoryModeChoice",
    "NRS",
    "myIrcAddresses",
    "skipAllDialogue",
    "infiniteCredits",
    "infinitePlatinum",
    "infiniteEndo",
    "infiniteRegalAya",
    "claimingBlueprintRefundsIngredients",
    "dontSubtractPurchaseCreditCost",
    "dontSubtractPurchasePlatinumCost",
    "dontSubtractPurchaseItemCost",
    "dontSubtractPurchaseStandingCost",
    "dontSubtractVoidTraces",
    "dontSubtractConsumables",
    "unlockAllProfitTakerStages",
    "unlockAllSimarisResearchEntries",
    "unlockAllScans",
    "unlockAllShipFeatures",
    "unlockAllCapturaScenes",
    "noDailyStandingLimits",
    "noDailyFocusLimit",
    "noArgonCrystalDecay",
    "noVendorPurchaseLimits",
    "noDecoBuildStage",
    "noDeathMarks",
    "noKimCooldowns",
    "syndicateMissionsRepeatable",
    "instantFinishRivenChallenge",
    "instantResourceExtractorDrones",
    "noResourceExtractorDronesDamage",
    "baroAlwaysAvailable",
    "baroFullyStocked",
    "missionsCanGiveAllRelics",
    "exceptionalRelicsAlwaysGiveBronzeReward",
    "flawlessRelicsAlwaysGiveSilverReward",
    "radiantRelicsAlwaysGiveGoldReward",
    "disableDailyTribute",
    "noDojoRoomBuildStage",
    "noDojoDecoBuildStage",
    "fastDojoRoomDestruction",
    "noDojoResearchCosts",
    "noDojoResearchTime",
    "fastClanAscension",
    "unlockAllSkins",
    "unlockAllFlavourItems",
    "unlockAllShipDecorations",
    "unlockAllDecoRecipes",
    "spoofMasteryRank",
    "relicRewardItemCountMultiplier",
    "nightwaveStandingMultiplier"
];
if (args.docker) {
    configRemovedOptionsKeys.push("bindAddress");
    configRemovedOptionsKeys.push("httpPort");
    configRemovedOptionsKeys.push("httpsPort");
}

export const configPath = path.join(repoDir, args.configPath ?? "config.json");

export const config: IConfig = {
    database: "mongodb://127.0.0.1:27017/openWF",
    logger: {
        files: true,
        level: "trace"
    },
    myAddress: "localhost"
};

export const loadConfig = (): void => {
    const newConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as IConfig;

    // Set all values to undefined now so if the new config.json omits some fields that were previously present, it's correct in-memory.
    for (const key of Object.keys(config)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (config as any)[key] = undefined;
    }

    Object.assign(config, newConfig);
};

export const getReflexiveAddress = (request: Request): { myAddress: string; myUrlBase: string } => {
    let myAddress: string;
    let myUrlBase: string = request.protocol + "://";
    if (request.host.indexOf("warframe.com") == -1) {
        // Client request was redirected cleanly, so we know it can reach us how it's reaching us now.
        myAddress = request.hostname;
        myUrlBase += request.host;
    } else {
        // Don't know how the client reached us, hoping the config does.
        myAddress = config.myAddress;
        myUrlBase += myAddress;
        const port: number = request.protocol == "http" ? config.httpPort || 80 : config.httpsPort || 443;
        if (port != (request.protocol == "http" ? 80 : 443)) {
            myUrlBase += ":" + port;
        }
    }
    return { myAddress, myUrlBase };
};

export const configIdToIndexable = (
    id: string
): [Record<string, boolean | string | number | null | undefined>, string] => {
    let obj = config as unknown as Record<string, never>;
    const arr = id.split(".");
    while (arr.length > 1) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        obj[arr[0]] ??= {} as never;
        obj = obj[arr[0]];
        arr.splice(0, 1);
    }
    return [obj, arr[0]];
};

const registrationRateLimitBounds: Record<string, { min: number; max: number }> = {
    "registrationRateLimit.windowMinutes": { min: 1, max: 525_600 },
    "registrationRateLimit.perAddress": { min: 1, max: 1_000_000 },
    "registrationRateLimit.global": { min: 1, max: 1_000_000 },
    "registrationRateLimit.globalAttempts": { min: 1, max: 10_000_000 }
};

export const validateRegistrationRateLimitConfig = (id: string, value: unknown): string | undefined => {
    if (!(id in registrationRateLimitBounds)) return undefined;
    const bounds = registrationRateLimitBounds[id];
    if (typeof value != "number" || !Number.isSafeInteger(value) || value < bounds.min || value > bounds.max) {
        return `${id} must be an integer from ${bounds.min} to ${bounds.max}`;
    }
    return undefined;
};

export const validateWorldStateBoostConfig = (id: string, value: unknown): string | undefined => {
    if (id != "worldState.boostExpiresAt") return undefined;
    if (value === undefined || value === null || value === "") return undefined;
    if (!isValidIsoDateTime(value)) {
        return `${id} must be an ISO 8601 date-time with a timezone`;
    }
    return undefined;
};

export const validateVarziaRotationConfig = (id: string, value: unknown): string | undefined => {
    if (id == "worldState.varziaCustomRotationEnabled") {
        return typeof value == "boolean" ? undefined : `${id} must be a boolean`;
    }
    if (id == "worldState.varziaCustomRotationMode") {
        return typeof value == "string" && ["daily", "weekly", "monthly", "custom"].includes(value)
            ? undefined
            : `${id} must be one of daily, weekly, monthly, custom`;
    }
    if (id == "worldState.varziaCustomRotationDays") {
        return typeof value == "number" && Number.isSafeInteger(value) && value >= 1 && value <= 3650
            ? undefined
            : `${id} must be an integer from 1 to 3650`;
    }
    return undefined;
};

const clientConfigTypes: Record<string, "boolean" | "number" | "string"> = {
    "client.fallback_language": "string",
    "client.fallback_languageVO": "string",
    "client.fallback_graphicsDriver": "string",
    "client.fallback_windowMode": "number",
    "client.fallback_cluster": "string",
    "client.language": "string",
    "client.server_host": "string",
    "client.http_port": "number",
    "client.https_port": "number",
    "client.secure_connections": "boolean",
    "client.high_damage_numbers_patch": "boolean",
    "client.skip_mission_start_timer": "boolean",
    "client.disable_profanity_filter": "boolean",
    "client.logout_on_request_failure": "boolean",
    "client.fov_override": "number",
    "client.simulacrum_blacklisted": "boolean",
    "client.simulacrum_whitelisted": "boolean",
    "client.pause_always_stops_time": "boolean",
    "client.disable_firewall_prompt": "boolean",
    "client.ee_log_in_console": "boolean",
    "client.alternative_loading": "boolean",
    "client.save_all_metadata": "boolean",
    "client.write_all_metadata_reads_to_console": "boolean",
    "client.write_all_metadata_reads_to_ee_log": "boolean",
    "client.write_patched_metadata_reads_to_console": "boolean",
    "client.write_patched_metadata_reads_to_ee_log": "boolean",
    "client.client_http_logging": "boolean",
    "client.disable_overlay": "boolean",
    "client.overlay_compatibility_mode": "boolean",
    "client.keep_console_open": "boolean"
};

export const validateClientConfig = (id: string, value: unknown): string | undefined => {
    if (!(id in clientConfigTypes))
        return id.startsWith("client.") ? `${id} is not a supported client setting` : undefined;
    const type = clientConfigTypes[id];
    if (value === null || typeof value !== type || (type === "number" && !Number.isFinite(value as number))) {
        return `${id} must be a ${type}`;
    }
    if (
        (id === "client.http_port" || id === "client.https_port") &&
        (!Number.isInteger(value as number) || (value as number) < 1 || (value as number) > 65535)
    ) {
        return `${id} must be an integer from 1 to 65535`;
    }
    if (id === "client.fov_override" && ((value as number) < 0 || (value as number) > 360))
        return `${id} must be from 0 to 360`;
    if (
        id === "client.fallback_windowMode" &&
        (!Number.isInteger(value as number) || (value as number) < -1 || (value as number) > 10)
    ) {
        return `${id} must be an integer from -1 to 10`;
    }
    return undefined;
};

export interface IWebServerParams {
    address: string;
    httpPort: number;
    httpsPort: number;
    certFile: string;
    keyFile: string;
}

export const getWebServerParams = (): IWebServerParams => {
    return {
        address: config.bindAddress || "0.0.0.0",
        httpPort: config.httpPort || 80,
        httpsPort: config.httpsPort || 443,
        certFile: config.httpsCertFile || "static/cert/cert.pem",
        keyFile: config.httpsKeyFile || "static/cert/key.pem"
    };
};

export const getNrsAddresses = (): [string, number][] => {
    return (config.nrsAddresses ?? []).map(nrsAddr => {
        nrsAddr = nrsAddr.replaceAll("%THIS_MACHINE%", "127.0.0.1");
        let nrsPort = 4950;
        const colon = nrsAddr.indexOf(":");
        if (colon != -1) {
            nrsPort = parseInt(nrsAddr.substring(colon + 1));
            nrsAddr = nrsAddr.substring(0, colon);
        }
        return [nrsAddr, nrsPort];
    });
};

export const getUdpRelayAddress = (request: Request): string | undefined => {
    if (!config.udpRelayPort) {
        return undefined;
    }
    return `${getReflexiveAddress(request).myAddress}:${config.udpRelayPort}`;
};

export const shouldDoServerQol = (
    key: TQolConfigKey,
    clientBuildLabel: string,
    introducedInBuildLabel: string
): boolean => {
    let value = config.serversideQualityOfLife?.[key];
    if (value === undefined) {
        value = configDefaults.serversideQualityOfLife[key];
    }
    if (value === null) {
        return version_compare(clientBuildLabel, introducedInBuildLabel) >= 0;
    }
    return value;
};
