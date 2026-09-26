import { Account } from "../models/loginModel.ts";
import type { TAccountDocument } from "./loginService.ts";
import { ACCOUNT_RATE_DEFINITIONS, getAccountRateProfile } from "./accountRateService.ts";
import { config, type IAccountRateProfile } from "./configService.ts";
import { saveConfig } from "./configWriterService.ts";

export const listAccountRates = async (): Promise<{
    definitions: typeof ACCOUNT_RATE_DEFINITIONS;
    accounts: { id: string; displayName: string; profile: Required<IAccountRateProfile>; hasCustomProfile: boolean }[];
    orphanedProfiles: string[];
}> => {
    const accounts = await Account.find({}, "DisplayName").sort({ DisplayName: 1 });
    const accountIds = new Set(accounts.map(account => account._id.toString()));
    return {
        definitions: ACCOUNT_RATE_DEFINITIONS,
        accounts: accounts.map(account => ({
            id: account._id.toString(),
            displayName: account.DisplayName,
            profile: getAccountRateProfile(account),
            hasCustomProfile: Boolean(
                config.accountRateProfiles?.[account._id.toString()] ||
                config.accountDropMultipliers?.[account.DisplayName]
            )
        })),
        orphanedProfiles: Object.keys(config.accountRateProfiles ?? {}).filter(id => !accountIds.has(id))
    };
};

export const findAccountForRates = (id: string): Promise<TAccountDocument | null> => Account.findById(id);

export const saveAccountRates = async (
    account: TAccountDocument,
    profile: IAccountRateProfile
): Promise<{ id: string; displayName: string; profile: Required<IAccountRateProfile> }> => {
    const id = account._id.toString();
    config.accountRateProfiles ??= {};
    config.accountRateProfiles[id] = profile;
    delete config.accountDropMultipliers?.[account.DisplayName];
    await saveConfig();
    return { id, displayName: account.DisplayName, profile: getAccountRateProfile(account) };
};

export const deleteAccountRates = async (account: TAccountDocument): Promise<void> => {
    delete config.accountRateProfiles?.[account._id.toString()];
    delete config.accountDropMultipliers?.[account.DisplayName];
    await saveConfig();
};
