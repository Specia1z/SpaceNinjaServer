import {
    METADATA_PATCH_SETTINGS_KEY,
    MetadataPatchSettings,
    type IMetadataPatchSettings
} from "../models/metadataPatchModel.ts";
import { config, type IMetadataPatchConfig } from "./configService.ts";

export interface IMetadataPatchState {
    rawPatches: string;
    patches: IMetadataPatchConfig[];
    accountPatches: Partial<Record<string, IMetadataPatchConfig[]>>;
}

let state: IMetadataPatchState | undefined;

const fromConfig = (): IMetadataPatchState => ({
    rawPatches: config.tunables?.rawMetadataPatches ?? "",
    patches: config.tunables?.metadataPatches ?? [],
    accountPatches: config.tunables?.accountMetadataPatches ?? {}
});

const fromDocument = (document: IMetadataPatchSettings): IMetadataPatchState => ({
    rawPatches: document.RawPatches,
    patches: document.Patches,
    accountPatches: document.AccountPatches
});

export const initializeMetadataPatches = async (): Promise<void> => {
    const initial = fromConfig();
    const document = await MetadataPatchSettings.findOneAndUpdate(
        { Key: METADATA_PATCH_SETTINGS_KEY },
        {
            $setOnInsert: {
                RawPatches: initial.rawPatches,
                Patches: initial.patches,
                AccountPatches: initial.accountPatches
            }
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    state = fromDocument(document!);
};

export const getMetadataPatchState = (): IMetadataPatchState => state ?? fromConfig();

export const saveMetadataPatchState = async (next: IMetadataPatchState): Promise<void> => {
    const document = await MetadataPatchSettings.findOneAndUpdate(
        { Key: METADATA_PATCH_SETTINGS_KEY },
        {
            $set: {
                RawPatches: next.rawPatches,
                Patches: next.patches,
                AccountPatches: next.accountPatches
            }
        },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    state = fromDocument(document!);
};
