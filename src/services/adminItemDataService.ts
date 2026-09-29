import fs from "node:fs/promises";
import path from "node:path";
import {
    ExportAbilities as bundledAbilities,
    ExportArcanes as bundledArcanes,
    ExportAvionics as bundledAvionics,
    ExportBoosterPacks as bundledBoosterPacks,
    ExportBoosters as bundledBoosters,
    ExportBundles as bundledBundles,
    ExportChallenges as bundledChallenges,
    ExportCreditBundles as bundledCreditBundles,
    ExportCustoms as bundledCustoms,
    ExportDojoRecipes as bundledDojoRecipes,
    ExportDrones as bundledDrones,
    ExportFactions as bundledFactions,
    ExportFlavour as bundledFlavour,
    ExportGear as bundledGear,
    ExportKeys as bundledKeys,
    ExportMissionTypes as bundledMissionTypes,
    ExportRailjackWeapons as bundledRailjackWeapons,
    ExportRecipes as bundledRecipes,
    ExportRegions as bundledRegions,
    ExportRelics as bundledRelics,
    ExportResources as bundledResources,
    ExportSentinels as bundledSentinels,
    ExportSyndicates as bundledSyndicates,
    ExportUpgrades as bundledUpgrades,
    ExportWarframes as bundledWarframes,
    ExportWeapons as bundledWeapons
} from "warframe-public-export-plus";
import type { IBundle, IChallenge, IPowersuit, ISentinel, IUpgrade, IWeapon } from "warframe-public-export-plus";
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";
import { repoDir } from "../helpers/pathHelper.ts";

const PUBLIC_EXPORT_DIR = path.join(repoDir, "node_modules", "warframe-public-export-plus");
const PACKAGE_MANIFEST = path.join(PUBLIC_EXPORT_DIR, "package.json");
const SUPPORTED_LANGUAGES = [
    "en",
    "de",
    "es",
    "fr",
    "it",
    "ja",
    "ko",
    "pl",
    "pt",
    "ru",
    "tc",
    "th",
    "tr",
    "uk",
    "zh"
] as const;

interface CoreSnapshot {
    abilities: typeof bundledAbilities;
    arcanes: typeof bundledArcanes;
    avionics: typeof bundledAvionics;
    boosterPacks: typeof bundledBoosterPacks;
    boosters: typeof bundledBoosters;
    bundles: typeof bundledBundles;
    challenges: typeof bundledChallenges;
    creditBundles: typeof bundledCreditBundles;
    customs: typeof bundledCustoms;
    dojoRecipes: typeof bundledDojoRecipes;
    drones: typeof bundledDrones;
    factions: typeof bundledFactions;
    flavour: typeof bundledFlavour;
    gear: typeof bundledGear;
    keys: typeof bundledKeys;
    missionTypes: typeof bundledMissionTypes;
    railjackWeapons: typeof bundledRailjackWeapons;
    recipes: typeof bundledRecipes;
    regions: typeof bundledRegions;
    relics: typeof bundledRelics;
    resources: typeof bundledResources;
    sentinels: typeof bundledSentinels;
    syndicates: typeof bundledSyndicates;
    upgrades: typeof bundledUpgrades;
    warframes: typeof bundledWarframes;
    weapons: typeof bundledWeapons;
}

interface AdminItemData extends CoreSnapshot {
    dictionary?: Record<string, string>;
}

interface SnapshotMetadata {
    source: string;
    packageVersion: string;
    syncedAt: string;
    counts: Record<string, number>;
    newestIntroducedAt?: number;
}

interface PackageManifest {
    name: string;
    version: string;
}

const TABLE_FILES: { [Key in keyof CoreSnapshot]: string } = {
    abilities: "ExportAbilities.json",
    arcanes: "ExportArcanes.json",
    avionics: "ExportAvionics.json",
    boosterPacks: "ExportBoosterPacks.json",
    boosters: "ExportBoosters.json",
    bundles: "ExportBundles.json",
    challenges: "ExportChallenges.json",
    creditBundles: "ExportCreditBundles.json",
    customs: "ExportCustoms.json",
    dojoRecipes: "ExportDojoRecipes.json",
    drones: "ExportDrones.json",
    factions: "ExportFactions.json",
    flavour: "ExportFlavour.json",
    gear: "ExportGear.json",
    keys: "ExportKeys.json",
    missionTypes: "ExportMissionTypes.json",
    railjackWeapons: "ExportRailjackWeapons.json",
    recipes: "ExportRecipes.json",
    regions: "ExportRegions.json",
    relics: "ExportRelics.json",
    resources: "ExportResources.json",
    sentinels: "ExportSentinels.json",
    syndicates: "ExportSyndicates.json",
    upgrades: "ExportUpgrades.json",
    warframes: "ExportWarframes.json",
    weapons: "ExportWeapons.json"
};
const FILE_TO_TABLE = Object.fromEntries(
    Object.entries(TABLE_FILES).map(([key, fileName]) => [fileName, key])
) as Partial<Record<string, keyof CoreSnapshot>>;

const bundledData: CoreSnapshot = {
    abilities: bundledAbilities,
    arcanes: bundledArcanes,
    avionics: bundledAvionics,
    boosterPacks: bundledBoosterPacks,
    boosters: bundledBoosters,
    bundles: bundledBundles,
    challenges: bundledChallenges,
    creditBundles: bundledCreditBundles,
    customs: bundledCustoms,
    dojoRecipes: bundledDojoRecipes,
    drones: bundledDrones,
    factions: bundledFactions,
    flavour: bundledFlavour,
    gear: bundledGear,
    keys: bundledKeys,
    missionTypes: bundledMissionTypes,
    railjackWeapons: bundledRailjackWeapons,
    recipes: bundledRecipes,
    regions: bundledRegions,
    relics: bundledRelics,
    resources: bundledResources,
    sentinels: bundledSentinels,
    syndicates: bundledSyndicates,
    upgrades: bundledUpgrades,
    warframes: bundledWarframes,
    weapons: bundledWeapons
};

let snapshot: CoreSnapshot | undefined;
let metadata: SnapshotMetadata | undefined;
let loaded = false;
let syncRunning = false;
const dictionaryCache = new Map<string, Record<string, string>>();

const readJson = async <T>(filePath: string): Promise<T> => {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
};

const getCollectionCount = (value: unknown): number => {
    if (Array.isArray(value)) return value.length;
    if (typeof value == "object" && value !== null) return Object.keys(value).length;
    return 0;
};

const validateCollection = (name: string, value: unknown): void => {
    if (getCollectionCount(value) === 0) {
        throw new Error(`${name} failed validation`);
    }
};

const collectDataFiles = async (directory = PUBLIC_EXPORT_DIR, prefix = ""): Promise<string[]> => {
    const files: string[] = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            files.push(...(await collectDataFiles(path.join(directory, entry.name), relativePath)));
        } else if (
            /^Export[^/]*\.json$/.test(relativePath) ||
            /^dict\.[a-z]+\.json$/.test(relativePath) ||
            /^supplementals\/.+\.json$/.test(relativePath)
        ) {
            files.push(relativePath);
        }
    }
    return files.sort();
};

const loadPackageData = async (): Promise<{ snapshot: CoreSnapshot; counts: Record<string, number> }> => {
    const counts: Record<string, number> = {};
    const snapshotEntries: [keyof CoreSnapshot, unknown][] = [];
    for (const relativePath of await collectDataFiles()) {
        const data = await readJson<unknown>(path.join(PUBLIC_EXPORT_DIR, ...relativePath.split("/")));
        validateCollection(relativePath, data);
        counts[relativePath.replace(/\.json$/, "")] = getCollectionCount(data);
        const table = FILE_TO_TABLE[relativePath];
        if (table) snapshotEntries.push([table, data]);
    }
    if (snapshotEntries.length != Object.keys(TABLE_FILES).length) {
        throw new Error("Bundled Public Export package is missing required item tables");
    }
    return {
        snapshot: Object.fromEntries(snapshotEntries) as unknown as CoreSnapshot,
        counts
    };
};

const getNewestIntroducedAt = (data: CoreSnapshot): number | undefined => {
    const introducedDates = [
        ...Object.values(data.warframes),
        ...Object.values(data.weapons),
        ...Object.values(data.upgrades)
    ]
        .map(item => item.introducedAt)
        .filter((value): value is number => typeof value == "number");
    return introducedDates.length ? Math.max(...introducedDates) : undefined;
};

const refreshPackageSnapshot = async (): Promise<void> => {
    const [{ snapshot: nextSnapshot, counts }, packageManifest] = await Promise.all([
        loadPackageData(),
        readJson<PackageManifest>(PACKAGE_MANIFEST)
    ]);
    if (packageManifest.name != "warframe-public-export-plus") {
        throw new Error("Invalid bundled Public Export package manifest");
    }

    snapshot = nextSnapshot;
    metadata = {
        source: "self-contained warframe-public-export-plus",
        packageVersion: packageManifest.version,
        syncedAt: new Date().toISOString(),
        counts,
        newestIntroducedAt: getNewestIntroducedAt(nextSnapshot)
    };
    dictionaryCache.clear();
};

const loadSnapshot = async (): Promise<void> => {
    if (loaded) return;
    loaded = true;
    try {
        await refreshPackageSnapshot();
    } catch {
        snapshot = bundledData;
        metadata = {
            source: "self-contained module imports",
            packageVersion: "unknown",
            syncedAt: new Date().toISOString(),
            counts: Object.fromEntries(
                Object.entries(TABLE_FILES).map(([key, fileName]) => [
                    fileName.replace(/\.json$/, ""),
                    getCollectionCount(bundledData[key as keyof CoreSnapshot])
                ])
            ),
            newestIntroducedAt: getNewestIntroducedAt(bundledData)
        };
    }
};

export const initializeAdminItemData = loadSnapshot;

const loadDictionary = async (language: string): Promise<Record<string, string> | undefined> => {
    const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])
        ? language
        : "en";
    const cached = dictionaryCache.get(normalizedLanguage);
    if (cached) return cached;
    try {
        const dictionary = await readJson<Record<string, string>>(
            path.join(PUBLIC_EXPORT_DIR, `dict.${normalizedLanguage}.json`)
        );
        validateCollection(`dict.${normalizedLanguage}.json`, dictionary);
        dictionaryCache.set(normalizedLanguage, dictionary);
        return dictionary;
    } catch {
        if (normalizedLanguage != "en") return loadDictionary("en");
        return undefined;
    }
};

export const getAdminItemData = async (language: string): Promise<AdminItemData> => {
    await loadSnapshot();
    return {
        ...(snapshot ?? bundledData),
        dictionary: await loadDictionary(language)
    };
};

export const getSyncedWarframe = (typeName: string): IPowersuit | undefined => snapshot?.warframes[typeName];
export const getSyncedWeapon = (typeName: string): IWeapon | undefined => snapshot?.weapons[typeName];
export const getSyncedUpgrade = (typeName: string): IUpgrade | undefined => snapshot?.upgrades[typeName];
export const getSyncedSentinel = (typeName: string): ISentinel | undefined => snapshot?.sentinels[typeName];
export const getSyncedBundle = (typeName: string): IBundle | undefined => snapshot?.bundles[typeName];
export const getChallenge = (typeName: string): IChallenge | undefined =>
    snapshot?.challenges[typeName] ?? bundledChallenges[typeName];
export const getChallengeByName = (name: string): { path: string; meta: IChallenge } | undefined => {
    const sources = [snapshot?.challenges, bundledChallenges];
    for (const source of sources) {
        if (!source) continue;
        const entry = Object.entries(source).find(([path]) => path.split("/").pop() == name);
        if (entry) return { path: entry[0], meta: entry[1] };
    }
    return undefined;
};

const buildVersionToTimestamp = (buildVersion: string): number => {
    const [year, month, day, hour, minute] = buildVersion.split(".").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 1000);
};

export const getGameVersionCutoff = (gameVersion: unknown): number | undefined => {
    if (gameVersion === undefined || gameVersion === "" || gameVersion === "latest") return undefined;
    if (typeof gameVersion != "string" || !(gameVersion in gameToBuildVersion)) {
        throw new Error("Unsupported game version");
    }
    return buildVersionToTimestamp((gameToBuildVersion as Record<string, string>)[gameVersion]);
};

export const isAvailableAt = (item: { introducedAt?: number }, cutoff: number | undefined): boolean => {
    return cutoff === undefined || item.introducedAt === undefined || item.introducedAt <= cutoff;
};

export const getAdminItemDataStatus = async (): Promise<{
    source: string;
    packageVersion: string;
    usingSyncedData: boolean;
    running: boolean;
    syncedAt?: string;
    counts: Record<string, number>;
    fileCount: number;
    totalEntries: number;
    newestIntroducedAt?: number;
    gameVersions: string[];
}> => {
    await loadSnapshot();
    const counts = metadata?.counts ?? {};
    return {
        source: metadata?.source ?? "self-contained warframe-public-export-plus",
        packageVersion: metadata?.packageVersion ?? "unknown",
        usingSyncedData: !!snapshot,
        running: syncRunning,
        syncedAt: metadata?.syncedAt,
        counts,
        fileCount: Object.keys(counts).length,
        totalEntries: Object.values(counts).reduce((total, count) => total + count, 0),
        newestIntroducedAt: metadata?.newestIntroducedAt,
        gameVersions: Object.keys(gameToBuildVersion)
    };
};

export const syncAdminItemData = async (): Promise<Awaited<ReturnType<typeof getAdminItemDataStatus>>> => {
    if (syncRunning) throw new Error("An item data synchronization is already running");
    syncRunning = true;
    try {
        await refreshPackageSnapshot();
    } finally {
        syncRunning = false;
    }
    return await getAdminItemDataStatus();
};
