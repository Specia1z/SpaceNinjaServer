import { ExportKeys, ExportRegions } from "warframe-public-export-plus";
import { BL_LATEST, BV_LATEST } from "../constants/gameVersions.ts";
import { addString } from "../helpers/stringHelpers.ts";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { addBooster, addChallenges, ensureUserHasSteelPathRewards, updateSlots } from "./inventoryService.ts";
import { addFixedLevelRewards } from "./missionInventoryUpdateService.ts";
import { completeQuest } from "./questService.ts";
import { handleStoreItemAcquisition } from "./purchaseService.ts";
import type { IMissionReward } from "../types/missionTypes.ts";

export const giveNewAccountStarterPack = async (inventory: TInventoryDatabaseDocument): Promise<void> => {
    inventory.PremiumCredits += 200;
    inventory.PremiumCreditsFree += 200;
    inventory.RegularCredits += 250_000;
    inventory.FusionPoints += 10_000;
    updateSlots(inventory, "SuitBin", 2, 0);
    updateSlots(inventory, "WeaponBin", 8, 0);

    const boosterDuration = 3 * 24 * 60 * 60;
    addBooster("/Lotus/Types/Boosters/AffinityBooster", boosterDuration, inventory);
    addBooster("/Lotus/Types/Boosters/CreditBooster", boosterDuration, inventory);
    addBooster("/Lotus/Types/Boosters/ResourceAmountBooster", boosterDuration, inventory);

    await inventory.save();
};

export const initializeNewAccount = async (inventory: TInventoryDatabaseDocument): Promise<void> => {
    for (const [questKey, quest] of Object.entries(ExportKeys)) {
        if ("chainStages" in quest) {
            await completeQuest(inventory, questKey, BL_LATEST);
        }
    }
    inventory.ActiveQuest = "";

    await completeAllMissions(inventory);
    await inventory.save();
};

export const completeAllMissions = async (
    inventory: TInventoryDatabaseDocument,
    includeSteelPath = true
): Promise<void> => {
    const MissionRewards: IMissionReward[] = [];
    for (const [tag, node] of Object.entries(ExportRegions)) {
        let mission = inventory.Missions.find(x => x.Tag == tag);
        if (!mission) {
            mission =
                inventory.Missions[
                    inventory.Missions.push({
                        Completes: 0,
                        Tier: 0,
                        Tag: tag
                    }) - 1
                ];
        }
        if (mission.Completes == 0) {
            mission.Completes++;
            if (node.missionReward) {
                await addFixedLevelRewards(node.missionReward, MissionRewards, BL_LATEST);
            }
        }
        if (includeSteelPath) {
            mission.Tier = 1;
        }
    }
    for (const reward of MissionRewards) {
        await handleStoreItemAcquisition(reward.StoreItem, inventory, reward.ItemCount, undefined, true);
    }
    await addChallenges(BV_LATEST, inventory, [
        { Progress: 1, Name: "KillPhorid" },
        { Progress: 1, Name: "SaviourOfCeres" },
        { Progress: 1, Name: "SaviourOfEarth" },
        { Progress: 1, Name: "SaviourOfEuropa" },
        { Progress: 1, Name: "SaviourOfJupiter" },
        { Progress: 1, Name: "SaviourOfMars" },
        { Progress: 1, Name: "SaviourOfMercury" },
        { Progress: 1, Name: "SaviourOfNeptune" },
        { Progress: 1, Name: "SaviourOfPhobos" },
        { Progress: 1, Name: "SaviourOfPluto" },
        { Progress: 1, Name: "SaviourOfSaturn" },
        { Progress: 1, Name: "SaviourOfSedna" },
        { Progress: 1, Name: "SaviourOfUranus" },
        { Progress: 1, Name: "SaviourOfVenus" }
    ]);
    if (includeSteelPath) {
        await ensureUserHasSteelPathRewards(inventory, true);
        addString(inventory.NodeIntrosCompleted, "TeshinHardModeUnlocked");
    }
    addString(inventory.NodeIntrosCompleted, "CetusInvasionNodeIntro");
    addString(inventory.NodeIntrosCompleted, "CetusSyndicate_IntroJob");
    let syndicate = inventory.Affiliations.find(x => x.Tag == "CetusSyndicate");
    if (!syndicate) {
        syndicate =
            inventory.Affiliations[inventory.Affiliations.push({ Tag: "CetusSyndicate", Standing: 250, Title: 0 })];
    }
};
