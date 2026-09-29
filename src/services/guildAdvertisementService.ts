import type { QueryFilter } from "mongoose";
import type { IGuildAdDatabase, IGuildAdInfoClient } from "../types/guildTypes.ts";
import { toMongoDate, toOid } from "../helpers/inventoryHelpers.ts";

export interface IGuildAdSearchOptions {
    tier?: number;
    name?: string;
    languages?: string[];
    features?: number;
    minMembers?: number;
    maxMembers?: number;
    limit?: number;
}

const getQueryValues = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(getQueryValues);
    }
    return typeof value == "string" ? value.split(",") : [];
};

const parseInteger = (value: unknown, min: number, max: number): number | undefined => {
    const first = getQueryValues(value).at(0);
    if (first === undefined || first.trim() === "") {
        return undefined;
    }
    const parsed = Number(first);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
};

export const normalizeGuildAdLanguages = (languages: unknown): string[] => {
    const normalized = getQueryValues(languages)
        .map(language => language.trim().toLowerCase())
        .filter(language => /^[a-z0-9-]{2,16}$/.test(language));
    return [...new Set(normalized)].slice(0, 16);
};

export const parseGuildAdSearchOptions = (query: Record<string, unknown>): IGuildAdSearchOptions => {
    const name = getQueryValues(query.name)[0]?.trim().slice(0, 64);
    const languages = normalizeGuildAdLanguages(query.language ?? query.languages);
    const minMembers = parseInteger(query.minMembers, 0, 100_000);
    const maxMembers = parseInteger(query.maxMembers, 0, 100_000);
    const limit = parseInteger(query.limit, 1, Number.MAX_SAFE_INTEGER);
    return {
        tier: parseInteger(query.tier, 0, 10),
        name: name || undefined,
        languages: languages.length ? languages : undefined,
        features: parseInteger(query.features ?? query.feature, 0, 0x7fffffff),
        minMembers,
        maxMembers:
            maxMembers !== undefined && (minMembers === undefined || maxMembers >= minMembers) ? maxMembers : undefined,
        limit: limit === undefined ? undefined : Math.min(limit, 500)
    };
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildGuildAdSearchQuery = (
    options: IGuildAdSearchOptions,
    now = new Date()
): QueryFilter<IGuildAdDatabase> => {
    const query: QueryFilter<IGuildAdDatabase> = { Expiry: { $gt: now } };
    if (options.tier !== undefined) {
        query.Tier = options.tier;
    }
    if (options.name) {
        query.GuildName = new RegExp(escapeRegex(options.name), "i");
    }
    if (options.languages?.length) {
        query.Languages = { $in: options.languages };
    }
    if (options.minMembers !== undefined || options.maxMembers !== undefined) {
        query.MemberCount = {
            ...(options.minMembers !== undefined ? { $gte: options.minMembers } : {}),
            ...(options.maxMembers !== undefined ? { $lte: options.maxMembers } : {})
        };
    }
    return query;
};

export const guildAdMatchesFeatures = (ad: Pick<IGuildAdDatabase, "Features">, features?: number): boolean =>
    features === undefined || (ad.Features & features) === features;

export const toGuildAdInfoClient = (ad: IGuildAdDatabase): IGuildAdInfoClient => ({
    _id: toOid(ad.GuildId),
    CrossPlatformEnabled: true,
    Emblem: ad.Emblem,
    Expiry: toMongoDate(ad.Expiry),
    Features: ad.Features,
    GuildName: ad.GuildName,
    Languages: ad.Languages,
    MemberCount: ad.MemberCount,
    OriginalPlatform: 0,
    RecruitMsg: ad.RecruitMsg,
    Tier: ad.Tier
});
