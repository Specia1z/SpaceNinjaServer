import {
    METADATA_PATCH_SETTINGS_KEY,
    MetadataPatchSettings,
    type IMetadataPatchSettings
} from "../models/metadataPatchModel.ts";
import { config, type IMetadataPatchConfig } from "./configService.ts";

export interface IMetadataPatchState {
    patches: IMetadataPatchConfig[];
    accountPatches: Partial<Record<string, IMetadataPatchConfig[]>>;
    accountBlacklist: string[];
}

let state: IMetadataPatchState | undefined;

const fromConfig = (): IMetadataPatchState => ({
    patches: config.tunables?.metadataPatches ?? [],
    accountPatches: config.tunables?.accountMetadataPatches ?? {},
    accountBlacklist: config.tunables?.metadataPatchBlacklist ?? []
});

const fromDocument = (document: IMetadataPatchSettings): IMetadataPatchState => ({
    patches: document.Patches,
    accountPatches: document.AccountPatches,
    accountBlacklist: document.AccountBlacklist ?? []
});

export const initializeMetadataPatches = async (): Promise<void> => {
    const initial = fromConfig();
    await MetadataPatchSettings.collection.updateMany({}, { $unset: { RawPatches: "" } });
    const document = await MetadataPatchSettings.findOneAndUpdate(
        { Key: METADATA_PATCH_SETTINGS_KEY },
        {
            $setOnInsert: {
                Patches: initial.patches,
                AccountPatches: initial.accountPatches,
                AccountBlacklist: initial.accountBlacklist
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
                Patches: next.patches,
                AccountPatches: next.accountPatches,
                AccountBlacklist: next.accountBlacklist
            }
        },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    state = fromDocument(document!);
};
