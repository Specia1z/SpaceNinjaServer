import type { Types } from "mongoose";
import { model, Schema } from "mongoose";

export interface IMissionSettlementClaim {
    accountId: Types.ObjectId;
    settlementKey: string;
    status: "processing" | "completed";
    claimToken: string;
    claimedAt: Date;
    completedAt?: Date;
}

const missionSettlementClaimSchema = new Schema<IMissionSettlementClaim>({
    accountId: { type: Schema.Types.ObjectId, required: true },
    settlementKey: { type: String, required: true },
    status: { type: String, enum: ["processing", "completed"], required: true },
    claimToken: { type: String, required: true },
    claimedAt: { type: Date, required: true },
    completedAt: Date
});

missionSettlementClaimSchema.index({ accountId: 1, settlementKey: 1 }, { unique: true });
missionSettlementClaimSchema.index({ claimedAt: 1 }, { expireAfterSeconds: 2_592_000 });

export const MissionSettlementClaim = model<IMissionSettlementClaim>(
    "MissionSettlementClaim",
    missionSettlementClaimSchema
);
