import { model, Schema } from "mongoose";

export interface IStoreOverride {
    TypeName: string;
    Enabled: boolean;
    Listed: boolean;
    Purchasable?: boolean;
    Giftable?: boolean;
    PurchaseMode?: "platinum" | "steam";
    CategoryName?: string;
    DiscountPercent?: number;
    PremiumPrice?: number;
    RegularPrice?: number;
    SupporterPack?: boolean;
    BogoBuy?: number;
    BogoGet?: number;
    Featured?: boolean;
    Popular?: boolean;
    BannerIndex?: number;
    CategoryStartDate?: Date;
    CategoryEndDate?: Date;
    ProductExpiryDate?: Date;
    StartDate?: Date;
    EndDate?: Date;
    UpdatedBy: string;
}

const storeOverrideSchema = new Schema<IStoreOverride>(
    {
        TypeName: { type: String, required: true },
        Enabled: { type: Boolean, required: true, default: true },
        Listed: { type: Boolean, required: true, default: true },
        Purchasable: Boolean,
        Giftable: Boolean,
        PurchaseMode: { type: String, enum: ["platinum", "steam"] },
        CategoryName: String,
        DiscountPercent: { type: Number, min: 0, max: 100 },
        PremiumPrice: { type: Number, min: 0 },
        RegularPrice: { type: Number, min: 0 },
        SupporterPack: Boolean,
        BogoBuy: { type: Number, min: 0, validate: Number.isInteger },
        BogoGet: { type: Number, min: 0, validate: Number.isInteger },
        Featured: Boolean,
        Popular: Boolean,
        BannerIndex: { type: Number, min: 0, validate: Number.isInteger },
        CategoryStartDate: Date,
        CategoryEndDate: Date,
        ProductExpiryDate: Date,
        StartDate: Date,
        EndDate: Date,
        UpdatedBy: { type: String, required: true }
    },
    { timestamps: true }
);

storeOverrideSchema.index({ TypeName: 1 }, { unique: true });

export const StoreOverride = model<IStoreOverride>("StoreOverride", storeOverrideSchema);
