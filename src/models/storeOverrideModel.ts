import { model, Schema } from "mongoose";

export interface IStoreOverride {
    TypeName: string;
    Enabled: boolean;
    Listed: boolean;
    DiscountPercent?: number;
    PremiumPrice?: number;
    RegularPrice?: number;
    StartDate?: Date;
    EndDate?: Date;
    UpdatedBy: string;
}

const storeOverrideSchema = new Schema<IStoreOverride>(
    {
        TypeName: { type: String, required: true },
        Enabled: { type: Boolean, required: true, default: true },
        Listed: { type: Boolean, required: true, default: true },
        DiscountPercent: { type: Number, min: 0, max: 100 },
        PremiumPrice: { type: Number, min: 0 },
        RegularPrice: { type: Number, min: 0 },
        StartDate: Date,
        EndDate: Date,
        UpdatedBy: { type: String, required: true }
    },
    { timestamps: true }
);

storeOverrideSchema.index({ TypeName: 1 }, { unique: true });

export const StoreOverride = model<IStoreOverride>("StoreOverride", storeOverrideSchema);
