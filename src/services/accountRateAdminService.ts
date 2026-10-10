import { Account } from "../models/loginModel.ts";
import type { TAccountDocument } from "./loginService.ts";
import {
    ACCOUNT_RATE_DEFINITIONS,
    getAccountRateProfile,
    type TResolvedAccountRateProfile
} from "./accountRateService.ts";
import {
    ACCOUNT_FEATURE_DEFINITIONS,
    getAccountFeatureProfile,
    type TResolvedAccountFeatureProfile
} from "./accountFeatureService.ts";
import { config, type IAccountRateProfile, type IAccountFeatureProfile } from "./configService.ts";
import { saveConfig } from "./configWriterService.ts";

export const listAccountRates = async (): Promise<{
    definitions: typeof ACCOUNT_RATE_DEFINITIONS;
    featureDefinitions: typeof ACCOUNT_FEATURE_DEFINITIONS;
    accounts: {
        id: string;
        displayName: string;
        profile: TResolvedAccountRateProfile;
        featureProfile: TResolvedAccountFeatureProfile;
        hasCustomProfile: boolean;
        hasCustomFeatures: boolean;
    }[];
    orphanedProfiles: string[];
    orphanedFeatureProfiles: string[];
}> => {
    const accounts = await Account.find({}, "DisplayName").sort({ DisplayName: 1 });
    const accountIds = new Set(accounts.map(account => account._id.toString()));
    return {
        definitions: ACCOUNT_RATE_DEFINITIONS,
        featureDefinitions: ACCOUNT_FEATURE_DEFINITIONS,
        accounts: accounts.map(account => ({
            id: account._id.toString(),
            displayName: account.DisplayName,
            profile: getAccountRateProfile(account),
            featureProfile: getAccountFeatureProfile(account._id.toString()),
            hasCustomProfile:
                Boolean(
                    config.accountRateProfiles?.[account._id.toString()] ||
                    config.accountDropMultipliers?.[account.DisplayName]
                ) || Object.values(config.accountFeatureProfiles?.[account._id.toString()] ?? {}).some(Boolean),
            hasCustomFeatures: Object.values(config.accountFeatureProfiles?.[account._id.toString()] ?? {}).some(
                Boolean
            )
        })),
        orphanedProfiles: Object.keys(config.accountRateProfiles ?? {}).filter(id => !accountIds.has(id)),
        orphanedFeatureProfiles: Object.keys(config.accountFeatureProfiles ?? {}).filter(id => !accountIds.has(id))
    };
};

export const findAccountForRates = (id: string): Promise<TAccountDocument | null> => Account.findById(id);

export const saveAccountRates = async (
    account: TAccountDocument,
    profile?: IAccountRateProfile,
    featureProfile?: IAccountFeatureProfile
): Promise<{
    id: string;
    displayName: string;
    profile: TResolvedAccountRateProfile;
    featureProfile: TResolvedAccountFeatureProfile;
    hasCustomFeatures: boolean;
}> => {
    const id = account._id.toString();
    if (profile !== undefined) {
        config.accountRateProfiles ??= {};
        config.accountRateProfiles[id] = profile;
        delete config.accountDropMultipliers?.[account.DisplayName];
    }
    if (featureProfile !== undefined) {
        if (Object.values(featureProfile).some(Boolean)) {
            config.accountFeatureProfiles ??= {};
            config.accountFeatureProfiles[id] = featureProfile;
        } else {
            delete config.accountFeatureProfiles?.[id];
        }
    }
    await saveConfig();
    return {
        id,
        displayName: account.DisplayName,
        profile: getAccountRateProfile(account),
        featureProfile: getAccountFeatureProfile(id),
        hasCustomFeatures: Object.values(config.accountFeatureProfiles?.[id] ?? {}).some(Boolean)
    };
};

export const deleteAccountRates = async (account: TAccountDocument): Promise<void> => {
    delete config.accountRateProfiles?.[account._id.toString()];
    delete config.accountDropMultipliers?.[account.DisplayName];
    await saveConfig();
};
