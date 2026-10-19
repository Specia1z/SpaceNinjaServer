import { ExportEnemies } from "warframe-public-export-plus";
import type { IRewardPool, TDroptable } from "warframe-public-export-plus";
import {
    DROP_TABLE_POOL_TYPES,
    DropTableOverride,
    type IDropTableItemOverride,
    type IDropTableOverride,
    type IDropTablePoolOverride,
    type TDropTablePoolType
} from "../models/dropTableOverrideModel.ts";
import { getDict, getString } from "./itemDataLocalizationService.ts";

const DROP_TABLE_PATH_PATTERN = /^\/Lotus\/Types\/DropTables\/[A-Za-z0-9_./-]+$/;
const ITEM_PATH_PATTERN = /^\/Lotus\/[A-Za-z0-9_./-]+$/;
const MAX_POOLS = 32;
const MAX_ITEMS_PER_POOL = 500;
const MISC_DROP_POOL_TYPES = ["resource", "additionalItem", "sigil", "relic"] as const;

const overrides = new Map<string, IDropTableOverride>();

export interface IDropTableEnemyReference {
    uniqueName: string;
    name: string;
    faction: string;
    isBoss: boolean;
}

export interface IDropTableListItem {
    DropTable: string;
    Enemies: IDropTableEnemyReference[];
    PoolCount: number;
    HasDefault: boolean;
    HasOverride: boolean;
    Enabled?: boolean;
}

export interface IDropTablePage {
    items: IDropTableListItem[];
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
}

export interface IDropTableDetail {
    DropTable: string;
    Enemies: IDropTableEnemyReference[];
    DefaultPools: TDroptable;
    Override?: IDropTableOverride;
}

const clonePools = (pools: readonly IDropTablePoolOverride[]): IDropTablePoolOverride[] =>
    pools.map(pool => ({
        type: pool.type,
        chance: pool.chance,
        items: pool.items.map(item => ({ type: item.type, probability: item.probability }))
    }));

export const isDropTablePath = (value: unknown): value is string =>
    typeof value == "string" && DROP_TABLE_PATH_PATTERN.test(value.trim());

export const isDropItemPath = (value: unknown): value is string =>
    typeof value == "string" && ITEM_PATH_PATTERN.test(value.trim());

const normalizePoolType = (value: unknown): TDropTablePoolType => {
    if (typeof value != "string" || !(DROP_TABLE_POOL_TYPES as readonly string[]).includes(value)) {
        throw new Error("Invalid drop table pool type");
    }
    return value as TDropTablePoolType;
};

const normalizeProbability = (value: unknown, label: string): number => {
    if (typeof value != "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
        throw new Error(`Invalid ${label}`);
    }
    return value;
};

const normalizeChance = (value: unknown): number => {
    if (typeof value != "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error("Invalid drop table chance");
    }
    return value;
};

const normalizePools = (value: unknown): IDropTablePoolOverride[] => {
    if (!Array.isArray(value) || value.length > MAX_POOLS) throw new Error("Invalid drop table pools");
    const poolTypes = new Set<TDropTablePoolType>();
    return value.map((rawPool, poolIndex) => {
        if (rawPool === null || typeof rawPool != "object" || Array.isArray(rawPool)) {
            throw new Error(`Invalid drop table pool ${poolIndex + 1}`);
        }
        const pool = rawPool as Record<string, unknown>;
        const type = normalizePoolType(pool.type);
        if (poolTypes.has(type)) throw new Error(`Duplicate drop table pool type ${type}`);
        poolTypes.add(type);
        if (!Array.isArray(pool.items) || pool.items.length > MAX_ITEMS_PER_POOL) {
            throw new Error(`Invalid items for drop table pool ${poolIndex + 1}`);
        }
        const items: IDropTableItemOverride[] = pool.items.map((rawItem, itemIndex) => {
            if (rawItem === null || typeof rawItem != "object" || Array.isArray(rawItem)) {
                throw new Error(`Invalid drop table item ${poolIndex + 1}.${itemIndex + 1}`);
            }
            const item = rawItem as Record<string, unknown>;
            if (!isDropItemPath(item.type))
                throw new Error(`Invalid drop table item ${poolIndex + 1}.${itemIndex + 1}`);
            return {
                type: item.type.trim(),
                probability: normalizeProbability(
                    item.probability,
                    `drop table item ${poolIndex + 1}.${itemIndex + 1} probability`
                )
            };
        });
        if (items.length > 0 && items.every(item => item.probability == 0)) {
            throw new Error(`Drop table pool ${poolIndex + 1} needs a positive item probability`);
        }
        return {
            type,
            chance: normalizeChance(pool.chance),
            items
        };
    });
};

export const normalizeDropTableOverride = (value: {
    DropTable: unknown;
    Enabled?: unknown;
    Pools: unknown;
    UpdatedBy: string;
}): IDropTableOverride => {
    if (!isDropTablePath(value.DropTable)) throw new Error("Invalid drop table path");
    if (value.Enabled !== undefined && typeof value.Enabled != "boolean") {
        throw new Error("Invalid drop table enabled state");
    }
    return {
        DropTable: value.DropTable.trim(),
        Enabled: value.Enabled !== false,
        Pools: normalizePools(value.Pools),
        UpdatedBy: value.UpdatedBy
    };
};

export const initializeDropTableOverrides = async (): Promise<void> => {
    overrides.clear();
    for (const override of await DropTableOverride.find().lean()) {
        overrides.set(override.DropTable, override);
    }
};

export const getDropTableOverride = (dropTable: string): IDropTableOverride | undefined => overrides.get(dropTable);

export const getEffectiveEnemyDropTable = (dropTable: string): TDroptable => {
    const override = overrides.get(dropTable);
    if (override?.Enabled) return clonePools(override.Pools) as unknown as TDroptable;
    return ExportEnemies.droptables[dropTable] ?? [];
};

export const getDropTablePoolType = (reportField: "DROP_MOD" | "DROP_BLUEPRINT"): TDropTablePoolType => {
    switch (reportField) {
        case "DROP_MOD":
            return "mod";
        case "DROP_BLUEPRINT":
            return "blueprint";
    }
};

export const getMiscDropTablePool = (dropTable: TDroptable): IRewardPool | undefined => {
    for (const poolType of MISC_DROP_POOL_TYPES) {
        const pool = dropTable.find(candidate => candidate.type == poolType);
        if (pool) return pool;
    }
    return undefined;
};

/**
 * StrippedItems contains successful client-side rolls, so the server cannot recreate an enemy for which the client
 * reported no drop. A custom chance can still downscale those reported rolls. Increasing a chance above the stock
 * value retains every reported roll and requires client-side enemy telemetry to create additional rolls.
 */
export const getReportedDropRetentionChance = (dropTable: string, poolType: TDropTablePoolType): number => {
    const override = overrides.get(dropTable);
    if (!override?.Enabled) return 1;
    const customPool = override.Pools.find(pool => pool.type == poolType);
    if (!customPool) return 0;

    const stockPool = (ExportEnemies.droptables[dropTable] ?? []).find(pool => pool.type == poolType);
    if (!stockPool || stockPool.chance <= 0) return customPool.chance > 0 ? 1 : 0;
    return Math.min(1, customPool.chance / stockPool.chance);
};

const getEnemyReferences = (dropTable: string, language: string): IDropTableEnemyReference[] => {
    const dict = getDict(language);
    return Object.entries(ExportEnemies.avatars)
        .filter(([, avatar]) => avatar.droptable == dropTable)
        .map(([uniqueName, avatar]) => ({
            uniqueName,
            name: getString(avatar.name, dict),
            faction: avatar.faction,
            isBoss: /\/Bosses\//i.test(uniqueName) || /boss/i.test(uniqueName)
        }))
        .sort((left, right) => left.name.localeCompare(right.name) || left.uniqueName.localeCompare(right.uniqueName));
};

const buildDropTableList = (language: string): IDropTableListItem[] => {
    const tableNames = new Set(Object.keys(ExportEnemies.droptables));
    for (const dropTable of overrides.keys()) tableNames.add(dropTable);

    return [...tableNames]
        .map(dropTable => {
            const override = overrides.get(dropTable);
            return {
                DropTable: dropTable,
                Enemies: getEnemyReferences(dropTable, language),
                PoolCount: (override?.Enabled ? override.Pools : (ExportEnemies.droptables[dropTable] ?? [])).length,
                HasDefault: Object.hasOwn(ExportEnemies.droptables, dropTable),
                HasOverride: override !== undefined,
                ...(override ? { Enabled: override.Enabled } : {})
            };
        })
        .sort((left, right) => left.DropTable.localeCompare(right.DropTable));
};

export const listDropTablePage = (
    requestedPage = 1,
    requestedPageSize = 25,
    search = "",
    language = "en"
): IDropTablePage => {
    const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || 25, 10), 100);
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const all = buildDropTableList(language).filter(item => {
        if (!normalizedSearch) return true;
        return [item.DropTable, ...item.Enemies.flatMap(enemy => [enemy.uniqueName, enemy.name, enemy.faction])].some(
            value => value.toLocaleLowerCase().includes(normalizedSearch)
        );
    });
    const total = all.length;
    const pageCount = Math.ceil(total / pageSize);
    const page = Math.min(Math.max(Math.trunc(requestedPage) || 1, 1), Math.max(pageCount, 1));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, pageCount, total };
};

export const getDropTableDetail = (dropTable: string, language = "en"): IDropTableDetail => {
    if (!isDropTablePath(dropTable)) throw new Error("Invalid drop table path");
    const normalized = dropTable.trim();
    return {
        DropTable: normalized,
        Enemies: getEnemyReferences(normalized, language),
        DefaultPools: ExportEnemies.droptables[normalized] ?? [],
        ...(overrides.has(normalized) ? { Override: overrides.get(normalized) } : {})
    };
};

export const saveDropTableOverride = async (override: IDropTableOverride): Promise<IDropTableOverride> => {
    const normalized = normalizeDropTableOverride(override);
    const saved = await DropTableOverride.findOneAndUpdate({ DropTable: normalized.DropTable }, normalized, {
        upsert: true,
        returnDocument: "after",
        runValidators: true
    }).lean();
    overrides.set(saved!.DropTable, saved!);
    return saved!;
};

export const deleteDropTableOverride = async (dropTable: string): Promise<boolean> => {
    if (!isDropTablePath(dropTable)) throw new Error("Invalid drop table path");
    const normalized = dropTable.trim();
    const result = await DropTableOverride.deleteOne({ DropTable: normalized });
    overrides.delete(normalized);
    return result.deletedCount > 0;
};

export const getDropTablePool = (dropTable: string, poolType: TDropTablePoolType): IRewardPool | undefined =>
    getEffectiveEnemyDropTable(dropTable).find(pool => pool.type == poolType);
