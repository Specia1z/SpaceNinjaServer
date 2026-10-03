import { model, Schema, type Types } from "mongoose";

export interface ICurrencyGrantStat {
    Day: string;
    AccountOwnerId: Types.ObjectId;
    Source: string;
    Platinum: number;
    RegalAya: number;
}

const currencyGrantStatSchema = new Schema<ICurrencyGrantStat>(
    {
        Day: { type: String, required: true },
        AccountOwnerId: { type: Schema.Types.ObjectId, required: true },
        Source: { type: String, required: true },
        Platinum: { type: Number, required: true, default: 0 },
        RegalAya: { type: Number, required: true, default: 0 }
    },
    { timestamps: true }
);

currencyGrantStatSchema.index({ Day: 1, AccountOwnerId: 1, Source: 1 }, { unique: true });
currencyGrantStatSchema.index({ Day: 1 });

export const CurrencyGrantStat = model<ICurrencyGrantStat>("CurrencyGrantStat", currencyGrantStatSchema);
