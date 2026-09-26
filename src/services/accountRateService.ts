import { config, type IAccountRateProfile } from "./configService.ts";

export type TAccountRateKey = Exclude<keyof IAccountRateProfile, "enabled">;

export interface IAccountRateDefinition {
    key: TAccountRateKey;
    group: "mission" | "progress" | "special";
    labelKey: string;
    descriptionKey: string;
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
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "modDropMultiplier",
        group: "mission",
        labelKey: "accountRates_modDropMultiplier",
        descriptionKey: "accountRates_modDropMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "creditMultiplier",
        group: "mission",
        labelKey: "accountRates_creditMultiplier",
        descriptionKey: "accountRates_creditMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "focusXpMultiplier",
        group: "mission",
        labelKey: "accountRates_focusXpMultiplier",
        descriptionKey: "accountRates_focusXpMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "standingMultiplier",
        group: "progress",
        labelKey: "accountRates_standingMultiplier",
        descriptionKey: "accountRates_standingMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "nightwaveStandingMultiplier",
        group: "progress",
        labelKey: "accountRates_nightwaveStandingMultiplier",
        descriptionKey: "accountRates_nightwaveStandingMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "relicRewardMultiplier",
        group: "progress",
        labelKey: "accountRates_relicRewardMultiplier",
        descriptionKey: "accountRates_relicRewardMultiplierHint",
        min: 1,
        max: 1000,
        step: 0.1
    },
    {
        key: "relicPlatinumMultiplier",
        group: "special",
        labelKey: "accountRates_relicPlatinumMultiplier",
        descriptionKey: "accountRates_relicPlatinumMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "missionPlatinumMultiplier",
        group: "special",
        labelKey: "accountRates_missionPlatinumMultiplier",
        descriptionKey: "accountRates_missionPlatinumMultiplierHint",
        min: 0,
        max: 1000,
        step: 0.1
    },
    {
        key: "dailyTributeMultiplier",
        group: "special",
        labelKey: "accountRates_dailyTributeMultiplier",
        descriptionKey: "accountRates_dailyTributeMultiplierHint",
        min: 1,
        max: 1000,
        step: 0.1
    }
];

export const normalizeAccountRateProfile = (value: unknown): IAccountRateProfile => {
    const profile: IAccountRateProfile = {};
    if (typeof value != "object" || value == null || Array.isArray(value)) {
        return profile;
    }

    const raw = value as Record<string, unknown>;
    if (typeof raw.enabled == "boolean") {
        profile.enabled = raw.enabled;
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
    for (const [key, multiplier] of Object.entries(raw)) {
        if (key == "enabled") continue;
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
    return raw as IAccountRateProfile;
};

export const getDefaultAccountRateProfile = (): Required<IAccountRateProfile> => ({
    enabled: true,
    resourceDropMultiplier: 1,
    modDropMultiplier: 1,
    creditMultiplier: 1,
    focusXpMultiplier: 1,
    standingMultiplier: 1,
    nightwaveStandingMultiplier: 1,
    relicRewardMultiplier: 1,
    relicPlatinumMultiplier: 1,
    missionPlatinumMultiplier: 1,
    dailyTributeMultiplier: 1
});

export const getAccountRateProfile = (account: {
    _id: { toString(): string };
    DisplayName: string;
}): Required<IAccountRateProfile> => {
    const defaults = getDefaultAccountRateProfile();
    const legacy = config.accountDropMultipliers?.[account.DisplayName];
    const configured = config.accountRateProfiles?.[account._id.toString()];
    const merged = normalizeAccountRateProfile({
        ...defaults,
        resourceDropMultiplier: legacy?.resourceMultiplier,
        modDropMultiplier: legacy?.modMultiplier,
        ...configured
    });
    return {
        ...defaults,
        ...merged,
        enabled: merged.enabled ?? defaults.enabled
    };
};

export const getEffectiveAccountRate = (profile: Required<IAccountRateProfile>, key: TAccountRateKey): number =>
    profile.enabled ? profile[key] : 1;
