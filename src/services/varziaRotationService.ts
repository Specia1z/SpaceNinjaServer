import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { configPath } from "./configService.ts";
import type { IPrimeVaultTrader } from "../types/worldStateTypes.ts";

const CACHE_VERSION = 2;
export const varziaRotationCachePath = path.join(path.dirname(configPath), "varzia-rotation-cache.json");

type TVarziaManifest = IPrimeVaultTrader["Manifest"];

export interface IVarziaRotationCache {
    version: 2;
    capturedAt: number;
    rotationStartedAt: number;
    startPoolIndex: number;
    rotationPool: string[];
    currentPackage: string;
    manifest: IPrimeVaultTrader["Manifest"];
    packageManifests: Record<string, TVarziaManifest>;
    evergreenManifest: IPrimeVaultTrader["EvergreenManifest"];
    scheduleInfo: IPrimeVaultTrader["ScheduleInfo"];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value == "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value == "number" && Number.isFinite(value);

const isKnownRotationPackage = (itemType: unknown): itemType is string =>
    typeof itemType == "string" && itemType.includes("/MegaPrimeVault/") && itemType.endsWith("DualPack");

const isManifest = (value: unknown): value is TVarziaManifest =>
    Array.isArray(value) && value.every(offer => isRecord(offer) && typeof offer.ItemType == "string");

const isManifestMap = (value: unknown): value is Record<string, TVarziaManifest> =>
    isRecord(value) &&
    Object.entries(value).every(
        ([packageName, manifest]) => isKnownRotationPackage(packageName) && isManifest(manifest)
    );

const loadRotationCache = (): IVarziaRotationCache | undefined => {
    try {
        const raw = JSON.parse(fs.readFileSync(varziaRotationCachePath, "utf8")) as unknown;
        if (!isRecord(raw) || (raw.version !== 1 && raw.version !== CACHE_VERSION)) return undefined;
        if (
            !isFiniteNumber(raw.capturedAt) ||
            !isFiniteNumber(raw.rotationStartedAt) ||
            !Number.isInteger(raw.startPoolIndex) ||
            !Array.isArray(raw.rotationPool) ||
            !raw.rotationPool.every(isKnownRotationPackage) ||
            raw.rotationPool.length == 0 ||
            !isKnownRotationPackage(raw.currentPackage) ||
            !isManifest(raw.manifest) ||
            !Array.isArray(raw.evergreenManifest) ||
            !Array.isArray(raw.scheduleInfo)
        ) {
            return undefined;
        }
        const startPoolIndex = raw.startPoolIndex as number;
        if (startPoolIndex < 0 || startPoolIndex >= raw.rotationPool.length) return undefined;
        const packageManifests =
            raw.version == 1
                ? { [raw.currentPackage]: raw.manifest }
                : isManifestMap(raw.packageManifests)
                  ? raw.packageManifests
                  : undefined;
        if (!packageManifests) return undefined;
        return {
            version: CACHE_VERSION,
            capturedAt: raw.capturedAt,
            rotationStartedAt: raw.rotationStartedAt,
            startPoolIndex,
            rotationPool: raw.rotationPool as string[],
            currentPackage: raw.currentPackage,
            manifest: raw.manifest,
            packageManifests,
            evergreenManifest: raw.evergreenManifest as IPrimeVaultTrader["EvergreenManifest"],
            scheduleInfo: raw.scheduleInfo as IPrimeVaultTrader["ScheduleInfo"]
        };
    } catch {
        return undefined;
    }
};

let rotationCache = loadRotationCache();

const getMongoDateMs = (value: unknown): number | undefined => {
    if (!isRecord(value) || !isRecord(value.$date)) return undefined;
    const numberLong = value.$date.$numberLong;
    const result = Number(numberLong);
    return Number.isFinite(result) ? result : undefined;
};

const getActiveTrader = (traders: IPrimeVaultTrader[], nowMs: number): IPrimeVaultTrader | undefined => {
    return (
        traders.find(trader => {
            const activation = getMongoDateMs(trader.Activation);
            const expiry = getMongoDateMs(trader.Expiry);
            return activation !== undefined && expiry !== undefined && activation <= nowMs && nowMs < expiry;
        }) ?? traders[0]
    );
};

export const getOfficialVarziaRotationPool = (trader: IPrimeVaultTrader): string[] => {
    const pool: string[] = [];
    for (const featuredItem of trader.ScheduleInfo.map(schedule => schedule.FeaturedItem)) {
        if (isKnownRotationPackage(featuredItem) && !pool.includes(featuredItem)) {
            pool.push(featuredItem);
        }
    }
    const currentPackage = trader.Manifest.find(offer => isKnownRotationPackage(offer.ItemType))?.ItemType;
    if (currentPackage && !pool.includes(currentPackage)) pool.push(currentPackage);
    return pool;
};

export const createVarziaRotationCache = (
    traders: IPrimeVaultTrader[],
    capturedAt: number,
    previous?: IVarziaRotationCache
): IVarziaRotationCache | undefined => {
    const trader = getActiveTrader(traders, capturedAt);
    if (!trader) return undefined;
    const currentPackage = trader.Manifest.find(offer => isKnownRotationPackage(offer.ItemType))?.ItemType;
    if (!currentPackage) return undefined;

    const officialRotationPool = getOfficialVarziaRotationPool(trader);
    if (officialRotationPool.length == 0) return undefined;

    return {
        version: CACHE_VERSION,
        capturedAt,
        rotationStartedAt: previous?.rotationStartedAt ?? capturedAt,
        startPoolIndex: previous?.startPoolIndex ?? officialRotationPool.indexOf(currentPackage),
        rotationPool: previous?.rotationPool ?? officialRotationPool,
        currentPackage,
        manifest: trader.Manifest,
        packageManifests: {
            ...(previous?.packageManifests ?? {}),
            [currentPackage]: trader.Manifest
        },
        evergreenManifest: trader.EvergreenManifest,
        scheduleInfo: trader.ScheduleInfo
    };
};

const writeRotationCache = async (cache: IVarziaRotationCache): Promise<void> => {
    const temporaryPath = `${varziaRotationCachePath}.tmp`;
    await fsPromises.writeFile(temporaryPath, JSON.stringify(cache, null, 2));
    await fsPromises.rename(temporaryPath, varziaRotationCachePath);
};

export const updateVarziaRotationCache = async (
    traders: IPrimeVaultTrader[],
    capturedAt = Date.now()
): Promise<IVarziaRotationCache | undefined> => {
    const cache = createVarziaRotationCache(traders, capturedAt, rotationCache);
    if (!cache) return undefined;

    rotationCache = cache;
    await fsPromises.mkdir(path.dirname(varziaRotationCachePath), { recursive: true });
    await writeRotationCache(cache);
    return cache;
};

export const getVarziaRotationAnchor = (): number | undefined => rotationCache?.rotationStartedAt;

export const getCachedVarziaRotation = (rotationIndex: number): string | undefined => {
    if (!rotationCache) return undefined;
    const poolLength = rotationCache.rotationPool.length;
    const index = (((rotationCache.startPoolIndex + rotationIndex) % poolLength) + poolLength) % poolLength;
    return rotationCache.rotationPool[index];
};

export const getCachedVarziaManifest = (dualPack: string): TVarziaManifest | undefined =>
    rotationCache?.packageManifests[dualPack];

export const getVarziaRotationCache = (): IVarziaRotationCache | undefined => rotationCache;
