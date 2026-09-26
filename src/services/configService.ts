import fs from "fs";
import path from "path";
import { repoDir } from "../helpers/pathHelper.ts";
import { args } from "../helpers/commandLineArguments.ts";
import type { Request } from "express";
import { version_compare } from "../helpers/inventoryHelpers.ts";
import configDefaults from "../../config-vanilla.json" with { type: "json" };

export type TRegionId = "ASIA" | "OCEANIA" | "EUROPE" | "RUSSIA" | "NORTH_AMERICA" | "SOUTH_AMERICA";

export interface IHubServer {
    address: string;
    regions?: TRegionId[];
    dtlsUnsupported?: boolean;
}

export interface IWebuiConfig {
    enabled?: boolean;
    adminOnly?: boolean;
    defaultLanguage?: string;
    nonAdminPermissions?: Record<string, boolean | Record<string, boolean>>;
}

export interface IMetadataPatchConfig {
    name?: string;
    enabled?: boolean;
    targets: string[];
    operations?: string[];
}

export interface IAccountDropMultiplier {
    /** Multiplier for resource drops reported in StrippedItems.DROP_MISC_ITEM. */
    resourceMultiplier?: number;
    /** Multiplier for mod drops reported in StrippedItems.DROP_MOD. */
    modMultiplier?: number;
}

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
    ircExecutable?: string;
    ircAddress?: string;
    hubExecutable?: string;
    udpRelayBindAddress?: string;
    udpRelayPort?: number;
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
    fallbackBuildLabel?: string;
    skipTutorial?: boolean;
    fullyStockedVendors?: boolean;
    skipClanKeyCrafting?: boolean;
    infiniteHelminthMaterials?: boolean;
    universalPolarityEverywhere?: boolean;
    unlockDoubleCapacityPotatoesEverywhere?: boolean;
    unlockExilusEverywhere?: boolean;
    unlockArcanesEverywhere?: boolean;
    missionPlatinumRewardMin?: number;
    missionPlatinumRewardMax?: number;
    /** Chance, in percent, that a completed mission awards the platinum reward at all. Undefined or 100 means always. */
    missionPlatinumRewardChance?: number;
    /** When true, the platinum reward is delivered as an Ordis inbox message instead of being credited silently. */
    missionPlatinumRewardSendMail?: boolean;
    /** Per-account mission drop multipliers, keyed by the exact DisplayName. */
    accountDropMultipliers?: Record<string, IAccountDropMultiplier>;
    relicPlatinumReward?: {
        common?: number;
        uncommon?: number;
        rare?: number;
    };
    /** @deprecated Use the two independent new-account options below. */
    autoCompleteQuestsAndUnlockMissions?: boolean;
    autoCompleteQuestsForNewAccounts?: boolean;
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
        tennoLiveRelay?: boolean;
        baroTennoConRelay?: boolean;
        baroAlwaysAvailable?: boolean;
        baroFullyStocked?: boolean;
        baroRelayOverride?: number;
        evilBaroStage?: number;
        varziaFullyStocked?: boolean;
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
        metadataPatches?: IMetadataPatchConfig[];
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

export const configIdToIndexable = (id: string): [Record<string, boolean | string | number | undefined>, string] => {
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

export const getAccountDropMultipliers = (
    account: Pick<{ DisplayName: string }, "DisplayName">
): Required<IAccountDropMultiplier> => {
    const configured = config.accountDropMultipliers?.[account.DisplayName];
    return {
        resourceMultiplier: configured?.resourceMultiplier ?? 1,
        modMultiplier: configured?.modMultiplier ?? 1
    };
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
