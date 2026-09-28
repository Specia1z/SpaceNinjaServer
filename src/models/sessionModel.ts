import { model, Schema, Types } from "mongoose";
import type { ISessionDatabase } from "../types/sessionTypes.ts";

const sessionSchema = new Schema<ISessionDatabase>({
    maxPlayers: Number,
    minPlayers: Number,
    privateSlots: Number,
    scoreLimit: Number,
    timeLimit: Number,
    gameModeId: { type: Number, required: true },
    eloRating: Number,
    regionId: { type: Number, required: true },
    difficulty: Number,
    hasStarted: { type: Boolean, required: true },
    enableVoice: Boolean,
    matchType: String,
    maps: [String],
    originalSessionId: String,
    customSettings: String,
    guildId: String,
    buildId: { type: BigInt, required: true },
    freePublic: Number,
    freePrivate: Number,
    fullReset: Number,

    creatorId: Types.ObjectId,
    members: [
        {
            _id: false,
            accountId: { type: Types.ObjectId, required: true },
            slotType: { type: String, enum: ["host", "public", "private"], required: true }
        }
    ],
    rewardSeed: BigInt,
    platform: Number,
    xplatform: Boolean,

    lastUpdate: Date
});

sessionSchema.index({ originalSessionId: 1 });
sessionSchema.index({ buildId: 1, gameModeId: 1, regionId: 1, hasStarted: 1, freePublic: 1 });

// The client seems to send an updateSession request at least once every 2 minutes.
sessionSchema.index({ lastUpdate: 1 }, { expireAfterSeconds: 5 * 60 });

export const Session = model<ISessionDatabase>("Session", sessionSchema);
