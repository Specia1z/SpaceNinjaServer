import { CraftingConfig, SERVER_WIDE_CRAFTING_KEY, type ICraftingConfig } from "../models/craftingConfigModel.ts";

// Resolved view of a crafting policy, with every value absolute rather than mode-based so that consumers do not
// have to re-interpret the modes.
export interface ResolvedCraftingConfig {
    buildTime: number | undefined;
    buildPriceMultiplier: number;
    skipBuildTimePrice: number | undefined;
    consumeOnUse: boolean | undefined;
}

const DEFAULT_CONFIG: ResolvedCraftingConfig = {
    buildTime: undefined,
    buildPriceMultiplier: 1,
    skipBuildTimePrice: undefined,
    consumeOnUse: undefined
};

const configs = new Map<string, ICraftingConfig>();

export const initializeCraftingConfigs = async (): Promise<void> => {
    configs.clear();
    for (const config of await CraftingConfig.find().lean()) {
        configs.set(config.Key, config);
    }
};

const getServerWideCraftingConfig = (): ICraftingConfig | undefined => configs.get(SERVER_WIDE_CRAFTING_KEY);

const getCraftingConfigForRecipe = (recipeTypeName: string): ICraftingConfig | undefined => configs.get(recipeTypeName);

export const listCraftingConfigs = async (): Promise<ICraftingConfig[]> => {
    return CraftingConfig.find().sort({ Key: 1 }).lean();
};

export const saveCraftingConfig = async (config: ICraftingConfig): Promise<ICraftingConfig> => {
    const saved = await CraftingConfig.findOneAndUpdate({ Key: config.Key }, config, {
        upsert: true,
        returnDocument: "after",
        runValidators: true
    }).lean();
    configs.set(saved!.Key, saved!);
    return saved!;
};

export const deleteCraftingConfig = async (key: string): Promise<boolean> => {
    const result = await CraftingConfig.deleteOne({ Key: key });
    configs.delete(key);
    return result.deletedCount > 0;
};

// "instant" is expressed as a zero build time. The client reads CompletionDate rather than buildTime, so a zero
// build time is what actually makes a recipe finish immediately.
const resolveBuildTime = (config: ICraftingConfig): number | undefined => {
    switch (config.SpeedMode) {
        case "instant":
            return 0;
        case "custom":
            return config.BuildTimeSeconds;
        default:
            return undefined;
    }
};

// Resolves the Platinum cost of rushing a recipe. `undefined` means "leave the value from the game data as-is",
// which is why it is distinct from 0 (= free).
const resolveRushCost = (config: ICraftingConfig): number | undefined => {
    switch (config.RushCostMode) {
        case "free":
            return 0;
        case "custom":
            return config.RushCostPlatinum;
        default:
            return undefined;
    }
};

const resolve = (config: ICraftingConfig): ResolvedCraftingConfig => ({
    buildTime: resolveBuildTime(config),
    buildPriceMultiplier: config.CostMultiplier,
    skipBuildTimePrice: resolveRushCost(config),
    // Blueprints are only preserved when the operator asks for it; otherwise the stock behaviour is kept.
    consumeOnUse: config.KeepBlueprints ? false : undefined
});

// Recipe-specific policy wins over the server-wide policy. Fields the winning policy leaves at "default" are
// inherited from the server-wide policy when one exists.
export const getCraftingOverride = (recipeTypeName: string): ResolvedCraftingConfig => {
    const serverWide = getServerWideCraftingConfig();
    const specific = getCraftingConfigForRecipe(recipeTypeName);
    if (!specific) {
        return serverWide ? resolve(serverWide) : DEFAULT_CONFIG;
    }
    const resolvedSpecific = resolve(specific);
    if (!serverWide) {
        return resolvedSpecific;
    }
    const resolvedServerWide = resolve(serverWide);
    return {
        buildTime: resolvedSpecific.buildTime ?? resolvedServerWide.buildTime,
        buildPriceMultiplier:
            specific.CostMultiplier === 1 ? resolvedServerWide.buildPriceMultiplier : specific.CostMultiplier,
        // Inherited per-field, not derived from buildTime: rushing cost and build duration are independent knobs,
        // so a policy that changes only the duration must keep whatever rush cost the other layer asked for.
        skipBuildTimePrice: resolvedSpecific.skipBuildTimePrice ?? resolvedServerWide.skipBuildTimePrice,
        consumeOnUse: resolvedSpecific.consumeOnUse ?? resolvedServerWide.consumeOnUse
    };
};
