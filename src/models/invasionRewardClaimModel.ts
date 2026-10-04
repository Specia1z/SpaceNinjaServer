import type { Types } from "mongoose";
import { model, Schema } from "mongoose";

export interface IInvasionRewardClaim {
    accountId: Types.ObjectId;
    invasionId: string;
    status: "processing" | "completed";
    claimToken: string;
    claimedAt: Date;
    completedAt?: Date;
}

const invasionRewardClaimSchema = new Schema<IInvasionRewardClaim>({
    accountId: { type: Schema.Types.ObjectId, required: true },
    invasionId: { type: String, required: true },
    status: { type: String, enum: ["processing", "completed"], required: true },
    claimToken: { type: String, required: true },
    claimedAt: { type: Date, required: true },
    completedAt: Date
});

invasionRewardClaimSchema.index({ accountId: 1, invasionId: 1 }, { unique: true });
invasionRewardClaimSchema.index({ claimedAt: 1 }, { expireAfterSeconds: 2_592_000 });

export const InvasionRewardClaim = model<IInvasionRewardClaim>("InvasionRewardClaim", invasionRewardClaimSchema);
