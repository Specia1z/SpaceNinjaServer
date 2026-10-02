import { model, Schema } from "mongoose";

export interface IStorePrice {
    TypeName: string;
    PremiumPrice?: number;
    RegularPrice?: number;
    Source: "public-export" | "supplemental";
    SyncedAt: Date;
}

const storePriceSchema = new Schema<IStorePrice>(
    {
        TypeName: { type: String, required: true },
        PremiumPrice: { type: Number, min: 0 },
        RegularPrice: { type: Number, min: 0 },
        Source: { type: String, enum: ["public-export", "supplemental"], required: true },
        SyncedAt: { type: Date, required: true }
    },
    { timestamps: true }
);

storePriceSchema.index({ TypeName: 1 }, { unique: true });

export const StorePrice = model<IStorePrice>("StorePrice", storePriceSchema);
