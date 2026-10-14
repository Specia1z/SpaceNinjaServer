import { config, type IAccountDropMultiplier, type IAccountRateProfile } from "./configService.ts";

export type TAccountRateKey = Exclude<keyof IAccountRateProfile, "enabled" | "expiresAt">;
export type TResolvedAccountRateProfile = Required<Omit<IAccountRateProfile, "expiresAt">> &
    Pick<IAccountRateProfile, "expiresAt">;

const isValidExpiration = (value: unknown): value is string =>
    typeof value == "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));

export interface IAccountRateDefinition {
    key: TAccountRateKey;
    group: "mission" | "progress" | "special";
    labelKey: string;
    descriptionKey: string;
    defaultValue: number;
    min: number;
    max: number;
    step: number;
}

export const ACCOUNT_RATE_DEFINITIONS: readonly IAccountRateDefinition[] = [
    {
        key: "resourceDropMultiplier",
        group: "mission",
        labelKey: "accountRates_resourceDropMultiplier",
        descriptionKey: "accountRates_resourceDropMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "modDropMultiplier",
        group: "mission",
        labelKey: "accountRates_modDropMultiplier",
        descriptionKey: "accountRates_modDropMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "creditMultiplier",
        group: "mission",
        labelKey: "accountRates_creditMultiplier",
        descriptionKey: "accountRates_creditMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "affinityMultiplier",
        group: "mission",
        labelKey: "accountRates_affinityMultiplier",
        descriptionKey: "accountRates_affinityMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "focusXpMultiplier",
        group: "mission",
        labelKey: "accountRates_focusXpMultiplier",
        descriptionKey: "accountRates_focusXpMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "standingMultiplier",
        group: "progress",
        labelKey: "accountRates_standingMultiplier",
        descriptionKey: "accountRates_standingMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "nightwaveStandingMultiplier",
        group: "progress",
        labelKey: "accountRates_nightwaveStandingMultiplier",
        descriptionKey: "accountRates_nightwaveStandingMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "relicRewardMultiplier",
        group: "progress",
        labelKey: "accountRates_relicRewardMultiplier",
        descriptionKey: "accountRates_relicRewardMultiplierHint",
        defaultValue: 1,
        min: 1,
        max: 1000,
        step: 0.1
    },
    {
        key: "relicPlatinumMultiplier",
        group: "special",
        labelKey: "accountRates_relicPlatinumMultiplier",
        descriptionKey: "accountRates_relicPlatinumMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "missionPlatinumMultiplier",
        group: "special",
        labelKey: "accountRates_missionPlatinumMultiplier",
        descriptionKey: "accountRates_missionPlatinumMultiplierHint",
        defaultValue: 1,
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "dailyTributeMultiplier",
        group: "special",
        labelKey: "accountRates_dailyTributeMultiplier",
        descriptionKey: "accountRates_dailyTributeMultiplierHint",
        defaultValue: 1,
        min: 1,
        max: 1000,
        step: 0.1
    }
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value == "object" && value != null && !Array.isArray(value);

/** Normalize the old display-name-based config shape before exposing it as a rate profile. */
export const normalizeLegacyAccountDropMultiplier = (value: unknown): IAccountDropMultiplier => {
    if (!isRecord(value)) return {};

    const normalized: IAccountDropMultiplier = {};
    for (const [legacyKey, profileKey] of [
        ["resourceMultiplier", "resourceDropMultiplier"],
        ["modMultiplier", "modDropMultiplier"]
    ] as const) {
        const rawValue = value[legacyKey];
        if (rawValue === undefined) continue;
        const definition = ACCOUNT_RATE_DEFINITIONS.find(item => item.key == profileKey)!;
        normalized[legacyKey] =
            typeof rawValue == "number" && Number.isFinite(rawValue)
                ? Math.min(definition.max, Math.max(definition.min, rawValue))
                : definition.defaultValue;
    }
    return normalized;
};

const legacyDropMultiplierToProfile = (value: unknown): IAccountRateProfile => {
    const legacy = normalizeLegacyAccountDropMultiplier(value);
    return {
        ...(legacy.resourceMultiplier === undefined ? {} : { resourceDropMultiplier: legacy.resourceMultiplier }),
        ...(legacy.modMultiplier === undefined ? {} : { modDropMultiplier: legacy.modMultiplier })
    };
};

export const normalizeAccountRateProfile = (value: unknown): IAccountRateProfile => {
    const profile: IAccountRateProfile = {};
    if (!isRecord(value)) return profile;

    const raw = value as Record<string, unknown>;
    if (typeof raw.enabled == "boolean") {
        profile.enabled = raw.enabled;
    }
    if (isValidExpiration(raw.expiresAt)) {
        profile.expiresAt = new Date(raw.expiresAt).toISOString();
    }

    for (const definition of ACCOUNT_RATE_DEFINITIONS) {
        const rawValue = raw[definition.key];
        if (typeof rawValue != "number" || !Number.isFinite(rawValue)) {
            continue;
        }
        profile[definition.key] = Math.min(definition.max, Math.max(definition.min, rawValue));
    }
    return profile;
};

export const parseAccountRateProfile = (value: unknown): IAccountRateProfile => {
    if (typeof value != "object" || value == null || Array.isArray(value)) {
        throw new Error("Profile must be an object");
    }
    const raw = value as Record<string, unknown>;
    if (raw.enabled !== undefined && typeof raw.enabled != "boolean") {
        throw new Error("enabled must be a boolean");
    }
    if (raw.expiresAt !== undefined && !isValidExpiration(raw.expiresAt)) {
        throw new Error("expiresAt must be an ISO 8601 date-time with a timezone");
    }
    for (const [key, multiplier] of Object.entries(raw)) {
        if (key == "enabled" || key == "expiresAt") continue;
        const definition = ACCOUNT_RATE_DEFINITIONS.find(item => item.key == key);
        if (!definition) throw new Error(`Unknown rate: ${key}`);
        if (
            typeof multiplier != "number" ||
            !Number.isFinite(multiplier) ||
            multiplier < definition.min ||
            multiplier > definition.max
        ) {
            throw new Error(`${key} must be between ${definition.min} and ${definition.max}`);
        }
    }
    return normalizeAccountRateProfile(raw);
};

export const getDefaultAccountRateProfile = (): TResolvedAccountRateProfile => {
    const defaults = {} as TResolvedAccountRateProfile;
    defaults.enabled = true;
    for (const { key, defaultValue } of ACCOUNT_RATE_DEFINITIONS) {
        defaults[key] = defaultValue;
    }
    return defaults;
};

export const getAccountRateProfile = (account: {
    _id: { toString(): string };
    DisplayName: string;
}): TResolvedAccountRateProfile => {
    const defaults = getDefaultAccountRateProfile();
    const legacy = legacyDropMultiplierToProfile(config.accountDropMultipliers?.[account.DisplayName]);
    const configured = config.accountRateProfiles?.[account._id.toString()];
    const merged = normalizeAccountRateProfile({ ...legacy, ...configured });
    return {
        ...defaults,
        ...merged,
        enabled: merged.enabled ?? defaults.enabled
    };
};

export const isAccountRateProfileActive = (profile: TResolvedAccountRateProfile, now = Date.now()): boolean =>
    profile.enabled && (!profile.expiresAt || now < Date.parse(profile.expiresAt));

export const getEffectiveAccountRate = (
    profile: TResolvedAccountRateProfile,
    key: TAccountRateKey,
    now = Date.now()
): number => (isAccountRateProfileActive(profile, now) ? profile[key] : 1);
