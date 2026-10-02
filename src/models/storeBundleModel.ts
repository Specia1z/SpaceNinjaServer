import { model, Schema } from "mongoose";

export interface IStoreBundleComponent {
    TypeName: string;
    PurchaseQuantity: number;
    DurabilityDays?: number;
}

export interface IStoreBundle {
    TypeName: string;
    Components: IStoreBundleComponent[];
}

const storeBundleComponentSchema = new Schema<IStoreBundleComponent>(
    {
        TypeName: { type: String, required: true },
        PurchaseQuantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
        DurabilityDays: { type: Number, min: 1, validate: Number.isInteger }
    },
    { _id: false }
);

const storeBundleSchema = new Schema<IStoreBundle>(
    {
        TypeName: { type: String, required: true },
        Components: {
            type: [storeBundleComponentSchema],
            required: true,
            validate: (value: unknown[]): boolean => value.length > 0
        }
    },
    { timestamps: true }
);

storeBundleSchema.index({ TypeName: 1 }, { unique: true });

export const StoreBundle = model<IStoreBundle>("StoreBundle", storeBundleSchema);
