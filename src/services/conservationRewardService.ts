import { ExportAnimals } from "warframe-public-export-plus";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IAffiliationMods } from "../types/purchaseTypes.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import { logger } from "../utils/logger.ts";
import { addMiscItems, addStanding } from "./inventoryService.ts";

export const handleConservation = async (
    inventory: TInventoryDatabaseDocument,
    buildLabel: string,
    missionReport: IMissionInventoryUpdateRequest,
    AffiliationMods: IAffiliationMods[],
    standingMultiplier: number = 1
): Promise<void> => {
    if (missionReport.CapturedAnimals) {
        for (const capturedAnimal of missionReport.CapturedAnimals) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const meta = ExportAnimals[capturedAnimal.AnimalType]?.conservation;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (meta) {
                if (capturedAnimal.NumTags) {
                    addMiscItems(inventory, [
                        {
                            ItemType: meta.itemReward,
                            ItemCount: capturedAnimal.NumTags * capturedAnimal.Count
                        }
                    ]);
                }
                if (capturedAnimal.NumExtraRewards) {
                    if (meta.woundedAnimalReward) {
                        addMiscItems(inventory, [
                            {
                                ItemType: meta.woundedAnimalReward,
                                ItemCount: capturedAnimal.NumExtraRewards * capturedAnimal.Count
                            }
                        ]);
                    } else {
                        logger.warn(
                            `client attempted to claim unknown extra rewards for conservation of ${capturedAnimal.AnimalType}`
                        );
                    }
                }
                if (meta.standingReward) {
                    await addStanding(
                        inventory,
                        buildLabel,
                        missionReport.Missions!.Tag == "SolNode129" ? "SolarisSyndicate" : "CetusSyndicate",
                        Math.trunc(
                            [2, 1.5, 1][capturedAnimal.CaptureRating] *
                                meta.standingReward *
                                capturedAnimal.Count *
                                standingMultiplier
                        ),
                        AffiliationMods
                    );
                }
            } else {
                logger.warn(`ignoring conservation of unknown AnimalType: ${capturedAnimal.AnimalType}`);
            }
        }
    }
};
