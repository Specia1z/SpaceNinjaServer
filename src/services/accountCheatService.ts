import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import {
    accountCheatBooleans,
    accountCheatNumbers,
    type IAccountCheats,
    type TAccountCheatBooleanKey,
    type TAccountCheatNumberKey
} from "../types/inventoryTypes/inventoryTypes.ts";
import { config } from "./configService.ts";
import { lockCheats } from "./cheatsService.ts";

const booleanDefaults: Record<TAccountCheatBooleanKey, boolean> = Object.fromEntries(
    accountCheatBooleans.map(key => [key, false])
) as Record<TAccountCheatBooleanKey, boolean>;

const numberDefaults: Record<TAccountCheatNumberKey, number> = {
    nemesisHenchmenKillsMultiplierGrineer: 1,
    nemesisHenchmenKillsMultiplierCorpus: 1,
    nemesisAntivirusGainMultiplier: 1,
    nemesisHintProgressMultiplierGrineer: 1,
    nemesisHintProgressMultiplierCorpus: 1,
    nemesisTaxRateReductionPercent: 0,
    nemesisExtraWeapon: 0,
    spoofMasteryRank: -1,
    dailyTributeRewardMultiplier: 1,
    relicRewardItemCountMultiplier: 1,
    teralystCapturePlatinumBonus: 0,
    gantulystCapturePlatinumBonus: 0,
    hydrolystCapturePlatinumBonus: 0,
    nightwaveStandingMultiplier: 1
};

export const defaultAccountCheats: IAccountCheats = {
    ...booleanDefaults,
    ...numberDefaults
};

export const accountCheatKeys = [...accountCheatBooleans, ...accountCheatNumbers] as readonly string[];

export const isAccountCheatKey = (key: string): key is keyof IAccountCheats => accountCheatKeys.includes(key);

export const getAccountCheatValue = <K extends keyof IAccountCheats>(key: K): NonNullable<IAccountCheats[K]> => {
    return (config.accountCheats?.[key] ?? defaultAccountCheats[key]) as NonNullable<IAccountCheats[K]>;
};

export const applyGlobalAccountCheats = (inventory: {
    set: (path: string, value: unknown) => void;
    unmarkModified: (path: string) => void;
}): void => {
    for (const key of accountCheatKeys as (keyof IAccountCheats)[]) {
        inventory.set(key, getAccountCheatValue(key));
        inventory.unmarkModified(key);
    }
};

const accountCheatNumberBounds: Partial<Record<TAccountCheatNumberKey, { min: number; max: number }>> = {
    spoofMasteryRank: { min: -1, max: 65535 },
    nemesisHenchmenKillsMultiplierGrineer: { min: 0, max: 65535 },
    nemesisHenchmenKillsMultiplierCorpus: { min: 0, max: 65535 },
    nemesisAntivirusGainMultiplier: { min: 0, max: 65535 },
    nemesisHintProgressMultiplierGrineer: { min: 0, max: 65535 },
    nemesisHintProgressMultiplierCorpus: { min: 0, max: 65535 },
    nemesisTaxRateReductionPercent: { min: 0, max: 100 },
    nemesisExtraWeapon: { min: 0, max: 65535 },
    dailyTributeRewardMultiplier: { min: 1, max: 1_000_000 },
    relicRewardItemCountMultiplier: { min: 1, max: 1_000_000 },
    teralystCapturePlatinumBonus: { min: 0, max: 1_000_000 },
    gantulystCapturePlatinumBonus: { min: 0, max: 1_000_000 },
    hydrolystCapturePlatinumBonus: { min: 0, max: 1_000_000 },
    nightwaveStandingMultiplier: { min: 1, max: 1_000_000 }
};

export const validateAccountCheatConfig = (id: string, value: unknown): string | undefined => {
    const prefix = "accountCheats.";
    if (!id.startsWith(prefix)) return undefined;

    const key = id.substring(prefix.length);
    if (!isAccountCheatKey(key)) return `Unknown account cheat: ${key}`;
    if (accountCheatBooleans.includes(key as TAccountCheatBooleanKey)) {
        return typeof value == "boolean" ? undefined : `${id} must be a boolean`;
    }

    const bounds = accountCheatNumberBounds[key as TAccountCheatNumberKey];
    if (
        typeof value != "number" ||
        !Number.isSafeInteger(value) ||
        (bounds && (value < bounds.min || value > bounds.max))
    ) {
        return `${id} must be an integer from ${bounds?.min ?? 0} to ${bounds?.max ?? 1_000_000}`;
    }
    return undefined;
};

export const applyGlobalAccountCheatSideEffects = async (key: keyof IAccountCheats, value: unknown): Promise<void> => {
    if (value !== true) return;
    const meta = lockCheats[key];
    if (!meta) return;

    const cursor = Inventory.find({}, `${key} ${meta.projection}`).cursor();
    for await (const inventory of cursor) {
        meta.cleanupInventory(inventory);
        if (!meta.isInventoryInIdealState(inventory)) {
            throw new Error(`cleanupInventory for ${key} did not satisfy its isInventoryInIdealState`);
        }
        await inventory.save();
    }
};
