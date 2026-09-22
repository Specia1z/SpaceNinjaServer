import fs from "node:fs/promises";
import path from "node:path";
import {
    ExportBoosterPacks as bundledBoosterPacks,
    ExportBundles as bundledBundles,
    ExportCreditBundles as bundledCreditBundles,
    ExportSentinels as bundledSentinels,
    ExportUpgrades as bundledUpgrades,
    ExportWarframes as bundledWarframes,
    ExportWeapons as bundledWeapons
} from "warframe-public-export-plus";
import type { IBundle, IPowersuit, ISentinel, IUpgrade, IWeapon } from "warframe-public-export-plus";
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";
import { repoDir } from "../helpers/pathHelper.ts";

const SOURCE_BASE = "https://browse.wf/warframe-public-export-plus";
const SNAPSHOT_DIR = path.join(repoDir, "static", "data", "admin-item-data");
const METADATA_FILE = "metadata.json";
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

interface AdminItemData {
    warframes: Record<string, IPowersuit>;
    weapons: Record<string, IWeapon>;
    upgrades: Record<string, IUpgrade>;
    sentinels: Record<string, ISentinel>;
    bundles: Record<string, IBundle>;
    dictionary?: Record<string, string>;
}

interface SnapshotMetadata {
    source: string;
    syncedAt: string;
    counts: Record<string, number>;
    etags: Record<string, string>;
    newestIntroducedAt?: number;
}

interface CoreSnapshot {
    warframes: Record<string, IPowersuit>;
    weapons: Record<string, IWeapon>;
    upgrades: Record<string, IUpgrade>;
    sentinels: Record<string, ISentinel>;
    bundles: Record<string, IBundle>;
    creditBundles: Record<string, unknown>;
    boosterPacks: Record<string, unknown>;
}

const bundledData: CoreSnapshot = {
    warframes: bundledWarframes,
    weapons: bundledWeapons,
    upgrades: bundledUpgrades,
    sentinels: bundledSentinels,
    bundles: bundledBundles,
    creditBundles: bundledCreditBundles,
    boosterPacks: bundledBoosterPacks
};

let snapshot: CoreSnapshot | undefined;
let metadata: SnapshotMetadata | undefined;
let loaded = false;
let syncRunning = false;
const dictionaryCache = new Map<string, Record<string, string>>();

const readJson = async <T>(filePath: string): Promise<T> => {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value == "object" && value !== null && !Array.isArray(value);
};

const validateRecord = (name: string, value: unknown, minimumEntries: number): Record<string, unknown> => {
    if (!isRecord(value) || Object.keys(value).length < minimumEntries) {
        throw new Error(`${name} failed validation`);
    }
    return value;
};

const loadSnapshot = async (): Promise<void> => {
    if (loaded) return;
    loaded = true;
    try {
        const [warframes, weapons, upgrades, sentinels, bundles, creditBundles, boosterPacks, savedMetadata] =
            await Promise.all([
                readJson<Record<string, IPowersuit>>(path.join(SNAPSHOT_DIR, "ExportWarframes.json")),
                readJson<Record<string, IWeapon>>(path.join(SNAPSHOT_DIR, "ExportWeapons.json")),
                readJson<Record<string, IUpgrade>>(path.join(SNAPSHOT_DIR, "ExportUpgrades.json")),
                readJson<Record<string, ISentinel>>(path.join(SNAPSHOT_DIR, "ExportSentinels.json")),
                readJson<Record<string, IBundle>>(path.join(SNAPSHOT_DIR, "ExportBundles.json")),
                readJson<Record<string, unknown>>(path.join(SNAPSHOT_DIR, "ExportCreditBundles.json")),
                readJson<Record<string, unknown>>(path.join(SNAPSHOT_DIR, "ExportBoosterPacks.json")),
                readJson<SnapshotMetadata>(path.join(SNAPSHOT_DIR, METADATA_FILE))
            ]);
        snapshot = { warframes, weapons, upgrades, sentinels, bundles, creditBundles, boosterPacks };
        metadata = savedMetadata;
    } catch {
        snapshot = undefined;
        metadata = undefined;
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
            path.join(SNAPSHOT_DIR, `dict.${normalizedLanguage}.json`)
        );
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
        dictionary: snapshot ? await loadDictionary(language) : undefined
    };
};

export const getSyncedWarframe = (typeName: string): IPowersuit | undefined => snapshot?.warframes[typeName];
export const getSyncedWeapon = (typeName: string): IWeapon | undefined => snapshot?.weapons[typeName];
export const getSyncedUpgrade = (typeName: string): IUpgrade | undefined => snapshot?.upgrades[typeName];
export const getSyncedSentinel = (typeName: string): ISentinel | undefined => snapshot?.sentinels[typeName];
export const getSyncedBundle = (typeName: string): IBundle | undefined => snapshot?.bundles[typeName];

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
    usingSyncedData: boolean;
    running: boolean;
    syncedAt?: string;
    counts: Record<string, number>;
    newestIntroducedAt?: number;
    gameVersions: string[];
}> => {
    await loadSnapshot();
    const activeData = snapshot ?? bundledData;
    return {
        source: metadata?.source ?? "bundled warframe-public-export-plus",
        usingSyncedData: !!snapshot,
        running: syncRunning,
        syncedAt: metadata?.syncedAt,
        counts: metadata?.counts ?? {
            warframes: Object.keys(activeData.warframes).length,
            weapons: Object.keys(activeData.weapons).length,
            upgrades: Object.keys(activeData.upgrades).length,
            sentinels: Object.keys(activeData.sentinels).length,
            bundles: Object.keys(activeData.bundles).length,
            creditBundles: Object.keys(activeData.creditBundles).length,
            boosterPacks: Object.keys(activeData.boosterPacks).length
        },
        newestIntroducedAt: metadata?.newestIntroducedAt,
        gameVersions: Object.keys(gameToBuildVersion)
    };
};

const downloadJson = async (fileName: string): Promise<{ data: unknown; etag: string }> => {
    const response = await fetch(`${SOURCE_BASE}/${fileName}?sync=${Date.now()}`, {
        headers: { "User-Agent": "SpaceNinjaServer-admin-sync" },
        signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`${fileName} returned HTTP ${response.status}`);
    return {
        data: await response.json(),
        etag: response.headers.get("etag") ?? ""
    };
};

export const syncAdminItemData = async (): Promise<Awaited<ReturnType<typeof getAdminItemDataStatus>>> => {
    if (syncRunning) throw new Error("An item data synchronization is already running");
    syncRunning = true;
    const stagingDir = `${SNAPSHOT_DIR}.staging-${process.pid}-${Date.now()}`;
    const backupDir = `${SNAPSHOT_DIR}.backup-${process.pid}`;
    try {
        await fs.mkdir(stagingDir, { recursive: true });
        const coreDefinitions = [
            ["warframes", "ExportWarframes.json", 100],
            ["weapons", "ExportWeapons.json", 700],
            ["upgrades", "ExportUpgrades.json", 1400],
            ["sentinels", "ExportSentinels.json", 30],
            ["bundles", "ExportBundles.json", 1000],
            ["creditBundles", "ExportCreditBundles.json", 20],
            ["boosterPacks", "ExportBoosterPacks.json", 30]
        ] as const;
        const downloadedCore: Partial<CoreSnapshot> = {};
        const counts: Record<string, number> = {};
        const etags: Record<string, string> = {};

        for (const [key, fileName, minimumEntries] of coreDefinitions) {
            const downloaded = await downloadJson(fileName);
            const record = validateRecord(fileName, downloaded.data, minimumEntries);
            downloadedCore[key] = record as never;
            counts[key] = Object.keys(record).length;
            etags[fileName] = downloaded.etag;
            await fs.writeFile(path.join(stagingDir, fileName), JSON.stringify(record));
        }

        for (const language of SUPPORTED_LANGUAGES) {
            const fileName = `dict.${language}.json`;
            const downloaded = await downloadJson(fileName);
            const dictionary = validateRecord(fileName, downloaded.data, 30_000);
            counts[`dict.${language}`] = Object.keys(dictionary).length;
            etags[fileName] = downloaded.etag;
            await fs.writeFile(path.join(stagingDir, fileName), JSON.stringify(dictionary));
        }

        const introducedDates = [
            ...Object.values(downloadedCore.warframes!),
            ...Object.values(downloadedCore.weapons!),
            ...Object.values(downloadedCore.upgrades!)
        ]
            .map(item => item.introducedAt)
            .filter((value): value is number => typeof value == "number");
        const nextMetadata: SnapshotMetadata = {
            source: SOURCE_BASE,
            syncedAt: new Date().toISOString(),
            counts,
            etags,
            newestIntroducedAt: introducedDates.length ? Math.max(...introducedDates) : undefined
        };
        await fs.writeFile(path.join(stagingDir, METADATA_FILE), JSON.stringify(nextMetadata, null, 2));

        await fs.rm(backupDir, { recursive: true, force: true });
        try {
            await fs.rename(SNAPSHOT_DIR, backupDir);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code != "ENOENT") throw error;
        }
        try {
            await fs.rename(stagingDir, SNAPSHOT_DIR);
        } catch (error) {
            await fs.rename(backupDir, SNAPSHOT_DIR).catch(() => undefined);
            throw error;
        }
        await fs.rm(backupDir, { recursive: true, force: true });

        snapshot = downloadedCore as CoreSnapshot;
        metadata = nextMetadata;
        dictionaryCache.clear();
    } finally {
        syncRunning = false;
        await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    }
    return await getAdminItemDataStatus();
};
