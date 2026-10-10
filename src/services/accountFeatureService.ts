import { config, type IAccountFeatureProfile } from "./configService.ts";

export const ACCOUNT_FEATURE_KEYS = [
    "universalPolarityEverywhere",
    "unlockDoubleCapacityPotatoesEverywhere",
    "unlockExilusEverywhere",
    "unlockArcanesEverywhere"
] as const;

export type TAccountFeatureKey = (typeof ACCOUNT_FEATURE_KEYS)[number];
export type TResolvedAccountFeatureProfile = Record<TAccountFeatureKey, boolean>;

export interface IAccountFeatureDefinition {
    key: TAccountFeatureKey;
    labelKey: string;
}

export const ACCOUNT_FEATURE_DEFINITIONS: readonly IAccountFeatureDefinition[] = ACCOUNT_FEATURE_KEYS.map(key => ({
    key,
    labelKey: `cheats_${key}`
}));

const getEmptyAccountFeatureProfile = (): TResolvedAccountFeatureProfile =>
    Object.fromEntries(ACCOUNT_FEATURE_KEYS.map(key => [key, false])) as TResolvedAccountFeatureProfile;

export const normalizeAccountFeatureProfile = (value: unknown): IAccountFeatureProfile => {
    const profile: IAccountFeatureProfile = {};
    if (typeof value != "object" || value == null || Array.isArray(value)) return profile;

    const raw = value as Record<string, unknown>;
    for (const key of ACCOUNT_FEATURE_KEYS) {
        if (typeof raw[key] == "boolean") profile[key] = raw[key];
    }
    return profile;
};

export const parseAccountFeatureProfile = (value: unknown): IAccountFeatureProfile => {
    if (typeof value != "object" || value == null || Array.isArray(value)) {
        throw new Error("Feature profile must be an object");
    }

    const raw = value as Record<string, unknown>;
    for (const [key, enabled] of Object.entries(raw)) {
        if (!(ACCOUNT_FEATURE_KEYS as readonly string[]).includes(key)) {
            throw new Error(`Unknown account feature: ${key}`);
        }
        if (typeof enabled != "boolean") {
            throw new Error(`${key} must be a boolean`);
        }
    }
    return normalizeAccountFeatureProfile(raw);
};

export const getAccountFeatureProfile = (accountId: string): TResolvedAccountFeatureProfile => ({
    ...getEmptyAccountFeatureProfile(),
    ...normalizeAccountFeatureProfile(config.accountFeatureProfiles?.[accountId])
});

export const getEffectiveAccountFeatureProfile = (accountId: string): TResolvedAccountFeatureProfile => {
    const configured = getAccountFeatureProfile(accountId);
    return Object.fromEntries(
        ACCOUNT_FEATURE_KEYS.map(key => [key, Boolean(config[key] || configured[key])])
    ) as TResolvedAccountFeatureProfile;
};
