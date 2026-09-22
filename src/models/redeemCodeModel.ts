import { model, Schema } from "mongoose";
import type { ITypeCount } from "../types/commonTypes.ts";
import type { Types } from "mongoose";

// A redemption code grants a bundle of items. Rewards are expressed as ITypeCount so that any uniqueName the
// server already understands (as resolved by addItem) can be handed out, including recipes, bundles, Mods,
// resources, and gear.
export interface IRedeemCode {
    // The code players type in. Stored uppercase so lookups are case-insensitive without an extra index.
    Code: string;

    // Optional human-readable label so an operator can recognise a code in the list. Not shown to players.
    Label?: string;

    // The items granted on redemption.
    Rewards: ITypeCount[];

    // When set, redemption is refused after this instant.
    ExpiresAt?: Date;

    // Total number of successful redemptions allowed. 0 means unlimited.
    MaxUses: number;

    // Number of successful redemptions so far. Kept in Mongo so concurrent redemptions cannot race past MaxUses.
    Uses: number;

    // One entry per account that already redeemed this code, so a player cannot redeem the same code twice.
    UsedBy: Types.ObjectId[];

    // Lets an operator retire a code without deleting its history.
    Enabled: boolean;

    CreatedBy: string;
}

export const MAX_REDEEM_CODE_USES = 1_000_000;
export const MAX_REDEEM_CODE_LENGTH = 64;

const redeemCodeSchema = new Schema<IRedeemCode>(
    {
        Code: { type: String, required: true },
        Label: String,
        Rewards: {
            type: [
                {
                    _id: false,
                    ItemType: { type: String, required: true },
                    ItemCount: { type: Number, required: true, min: -1_000_000, max: 1_000_000 }
                }
            ],
            required: true
        },
        ExpiresAt: Date,
        MaxUses: { type: Number, required: true, min: 0, max: MAX_REDEEM_CODE_USES, default: 0 },
        Uses: { type: Number, required: true, min: 0, default: 0 },
        UsedBy: { type: [Schema.Types.ObjectId], required: true, default: [] },
        Enabled: { type: Boolean, required: true, default: true },
        CreatedBy: { type: String, required: true }
    },
    { timestamps: true }
);

redeemCodeSchema.index({ Code: 1 }, { unique: true });

export const RedeemCode = model<IRedeemCode>("RedeemCode", redeemCodeSchema);
