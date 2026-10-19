import { model, Schema } from "mongoose";

export const DROP_TABLE_POOL_TYPES = ["mod", "blueprint", "resource", "sigil", "additionalItem", "relic"] as const;
export type TDropTablePoolType = (typeof DROP_TABLE_POOL_TYPES)[number];

export interface IDropTableItemOverride {
    type: string;
    probability: number;
}

export interface IDropTablePoolOverride {
    type: TDropTablePoolType;
    chance: number;
    items: IDropTableItemOverride[];
}

export interface IDropTableOverride {
    DropTable: string;
    Enabled: boolean;
    Pools: IDropTablePoolOverride[];
    UpdatedBy: string;
}

const dropTableItemSchema = new Schema<IDropTableItemOverride>(
    {
        type: { type: String, required: true },
        probability: { type: Number, required: true, min: 0, max: 1_000_000_000 }
    },
    { _id: false }
);

const dropTablePoolSchema = new Schema<IDropTablePoolOverride>(
    {
        type: { type: String, required: true, enum: DROP_TABLE_POOL_TYPES },
        chance: { type: Number, required: true, min: 0, max: 1 },
        items: { type: [dropTableItemSchema], required: true, default: [] }
    },
    { _id: false }
);

const dropTableOverrideSchema = new Schema<IDropTableOverride>(
    {
        DropTable: { type: String, required: true, unique: true },
        Enabled: { type: Boolean, required: true, default: true },
        Pools: { type: [dropTablePoolSchema], required: true, default: [] },
        UpdatedBy: { type: String, required: true }
    },
    { timestamps: true }
);

dropTableOverrideSchema.index({ DropTable: 1 }, { unique: true });

export const DropTableOverride = model<IDropTableOverride>("DropTableOverride", dropTableOverrideSchema);
