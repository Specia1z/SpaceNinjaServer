import type {
    IAlertDatabase,
    IDailyDealDatabase,
    IFissureDatabase,
    ILiveWorldActivityState
} from "../types/worldStateTypes.ts";
import { model, Schema } from "mongoose";
import { typeCountSchema } from "./inventoryModels/inventoryModel.ts";

const fissureSchema = new Schema<IFissureDatabase>({
    Activation: Date,
    Expiry: Date,
    Node: String, // must be unique
    Modifier: String,
    Hard: Boolean
});

fissureSchema.index({ Expiry: 1 }, { expireAfterSeconds: 0 }); // With this, MongoDB will automatically delete expired entries.

export const Fissure = model<IFissureDatabase>("Fissure", fissureSchema);

const dailyDealSchema = new Schema<IDailyDealDatabase>({
    StoreItem: { type: String, required: true },
    Activation: { type: Date, required: true },
    Expiry: { type: Date, required: true },
    Discount: { type: Number, required: true },
    OriginalPrice: { type: Number, required: true },
    SalePrice: { type: Number, required: true },
    AmountTotal: { type: Number, required: true },
    AmountSold: { type: Number, required: true }
});

dailyDealSchema.index({ StoreItem: 1 }, { unique: true });
dailyDealSchema.index({ Expiry: 1 }, { expireAfterSeconds: 86400 });

export const DailyDeal = model<IDailyDealDatabase>("DailyDeal", dailyDealSchema);

const alertSchema = new Schema<IAlertDatabase>({
    Activation: { type: Date, required: true },
    Expiry: { type: Date, required: true },
    MissionInfo: {
        location: { type: String, required: true },
        missionType: { type: String, required: true },
        faction: { type: String, required: true },
        difficulty: { type: Number, required: true },
        missionReward: {
            credits: { type: Number, required: true },
            items: [String],
            countedItems: [typeCountSchema]
        },
        levelOverride: String,
        enemySpec: String,
        extraEnemySpec: String,
        minEnemyLevel: { type: Number, required: true },
        maxEnemyLevel: { type: Number, required: true },
        descText: String,
        nightmare: Boolean
    }
});

alertSchema.index({ Expiry: 1 }, { expireAfterSeconds: 0 });

const liveWorldActivityStateSchema = new Schema<ILiveWorldActivityState>({
    type: { type: String, required: true },
    officialId: { type: String, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    localCount: { type: Number, required: true, default: 0 },
    goal: { type: Number, required: true },
    status: { type: String, enum: ["active", "completed"], required: true, default: "active" },
    lastSeenAt: { type: Date, required: true },
    completedAt: Date,
    expiresAt: { type: Date, required: true }
});

liveWorldActivityStateSchema.index({ type: 1, officialId: 1 }, { unique: true });
liveWorldActivityStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LiveWorldActivityState = model<ILiveWorldActivityState>(
    "LiveWorldActivityState",
    liveWorldActivityStateSchema
);
