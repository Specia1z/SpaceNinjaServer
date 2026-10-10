import { model, Schema } from "mongoose";
import type { IMetadataPatchConfig } from "../services/configService.ts";

export const METADATA_PATCH_SETTINGS_KEY = "server";

export interface IMetadataPatchSettings {
    Key: string;
    Patches: IMetadataPatchConfig[];
    AccountPatches: Partial<Record<string, IMetadataPatchConfig[]>>;
    AccountBlacklist?: string[];
}

const metadataPatchSchema = new Schema<IMetadataPatchConfig>(
    {
        name: String,
        enabled: Boolean,
        text: String,
        targets: [String],
        operations: [String]
    },
    { _id: false }
);

const metadataPatchSettingsSchema = new Schema<IMetadataPatchSettings>(
    {
        Key: { type: String, required: true, unique: true },
        Patches: { type: [metadataPatchSchema], required: true, default: [] },
        AccountPatches: { type: Schema.Types.Mixed, required: true, default: {} },
        AccountBlacklist: { type: [String], required: true, default: [] }
    },
    { timestamps: true }
);

export const MetadataPatchSettings = model<IMetadataPatchSettings>(
    "MetadataPatchSettings",
    metadataPatchSettingsSchema
);
