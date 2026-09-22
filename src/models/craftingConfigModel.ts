import { model, Schema } from "mongoose";

// Options deliberately avoid mirroring the raw recipe fields. A private server operator wants to express intent
// ("make building quick", "make building cheap"), not to know that buildTime is measured in seconds and that
// skipBuildTimePrice is a Platinum cost that scales with elapsed progress.
type TCraftingSpeedMode = "default" | "instant" | "custom";

// The Platinum cost of rushing a build is orthogonal to how long the build takes, so it gets its own mode rather
// than being derived from SpeedMode. "stock" keeps the per-recipe value from the game data (typically 25/50),
// "free" makes rushing cost nothing, "custom" charges RushCostPlatinum instead.
type TCraftingRushCostMode = "stock" | "free" | "custom";

export interface ICraftingConfig {
    // Identifies this document. A single shared document is used for the server-wide policy.
    Key: string;

    // "default" leaves buildTime untouched, "instant" finishes recipes immediately, "custom" uses BuildTimeSeconds.
    SpeedMode: TCraftingSpeedMode;
    BuildTimeSeconds: number;

    // Multiplier applied to buildPrice. 0 makes building free, 1 keeps the stock price.
    CostMultiplier: number;

    // How much Platinum it costs to rush (skip) a recipe.
    RushCostMode: TCraftingRushCostMode;
    // Platinum charged when RushCostMode is "custom". Ignored otherwise.
    RushCostPlatinum: number;

    // When true, blueprints survive a build instead of being consumed.
    KeepBlueprints: boolean;

    // Target of this policy. Recipes matching a type-specific policy win over the server-wide policy.
    TypeName?: string;

    UpdatedBy: string;
}

export const SERVER_WIDE_CRAFTING_KEY = "server";

const craftingConfigSchema = new Schema<ICraftingConfig>(
    {
        Key: { type: String, required: true },
        SpeedMode: { type: String, required: true, enum: ["default", "instant", "custom"], default: "default" },
        BuildTimeSeconds: { type: Number, required: true, min: 0, max: 31_536_000, default: 0 },
        CostMultiplier: { type: Number, required: true, min: 0, max: 100, default: 1 },
        RushCostMode: { type: String, required: true, enum: ["stock", "free", "custom"], default: "stock" },
        RushCostPlatinum: { type: Number, required: true, min: 0, max: 1_000_000, default: 0 },
        KeepBlueprints: { type: Boolean, required: true, default: false },
        TypeName: String,
        UpdatedBy: { type: String, required: true }
    },
    { timestamps: true }
);

craftingConfigSchema.index({ Key: 1 }, { unique: true });

export const CraftingConfig = model<ICraftingConfig>("CraftingConfig", craftingConfigSchema);
