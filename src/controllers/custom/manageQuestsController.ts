import { getInventory, getInventory2 } from "../../services/inventoryService.ts";
import { getAccountIdForRequest } from "../../services/loginService.ts";
import {
    completeAllQuests,
    completeQuest,
    giveKeyChainMissionReward,
    giveKeyChainStageTriggered,
    getQuestKeyTypes
} from "../../services/questService.ts";
import { logger } from "../../utils/logger.ts";
import type { RequestHandler } from "express";
import { broadcastInventoryUpdate } from "../../services/wsService.ts";
import type { TInventoryDatabaseDocument } from "../../models/inventoryModels/inventoryModel.ts";
import { BL_LATEST } from "../../constants/gameVersions.ts";
import { getKey } from "../../services/itemDataService.ts";

export const manageQuestsController: RequestHandler = async (req, res) => {
    const accountId = await getAccountIdForRequest(req);
    const operation = req.query.operation as
        | "completeAll"
        | "resetAll"
        | "completeKey"
        | "deleteKey"
        | "resetKey"
        | "prevStage"
        | "nextStage"
        | "setInactive";

    const questItemType = req.query.itemType as string;

    const allQuestKeys = getQuestKeyTypes(true);

    let modified = false;
    switch (operation) {
        case "completeAll": {
            const inventory = await getInventory(accountId, undefined);
            await completeAllQuests(inventory, BL_LATEST, false, true);
            modified = await saveOnDemand(inventory);
            break;
        }
        case "resetAll": {
            const inventory = await getInventory2(accountId, "QuestKeys", "ActiveQuest");
            for (const questKey of inventory.QuestKeys) {
                questKey.Completed = false;
                questKey.Progress = [];
                questKey.CompletionDate = undefined;
            }
            inventory.ActiveQuest = "";
            modified = await saveOnDemand(inventory);
            break;
        }
        case "deleteKey": {
            const inventory = await getInventory2(accountId, "QuestKeys", "ActiveQuest");
            const questKey = inventory.QuestKeys.find(key => key.ItemType === questItemType);
            if (!questKey) {
                logger.error(`Quest key not found in inventory: ${questItemType}`);
                break;
            }
            inventory.QuestKeys.pull({ ItemType: questItemType });
            if (inventory.ActiveQuest == questItemType) inventory.ActiveQuest = "";
            modified = await saveOnDemand(inventory);
            break;
        }
        case "completeKey": {
            if (allQuestKeys.includes(questItemType)) {
                const inventory = await getInventory(accountId, undefined);
                const questKey = inventory.QuestKeys.find(key => key.ItemType === questItemType);
                if (!questKey) {
                    logger.error(`Quest key not found in inventory: ${questItemType}`);
                    break;
                }
                await completeQuest(inventory, questItemType, BL_LATEST);
                modified = await saveOnDemand(inventory);
            }
            break;
        }
        case "resetKey": {
            if (allQuestKeys.includes(questItemType)) {
                const inventory = await getInventory2(accountId, "QuestKeys");
                const questKey = inventory.QuestKeys.find(key => key.ItemType === questItemType);
                if (!questKey) {
                    logger.error(`Quest key not found in inventory: ${questItemType}`);
                    break;
                }
                questKey.Completed = false;
                questKey.Progress = [];
                questKey.CompletionDate = undefined;
                modified = await saveOnDemand(inventory);
            }
            break;
        }
        case "prevStage": {
            if (allQuestKeys.includes(questItemType)) {
                const inventory = await getInventory(accountId, undefined);
                const questKey = inventory.QuestKeys.find(key => key.ItemType === questItemType);
                if (!questKey) {
                    logger.error(`Quest key not found in inventory: ${questItemType}`);
                    break;
                }
                if (!questKey.Progress) break;

                if (questKey.Completed) {
                    questKey.Completed = false;
                    questKey.CompletionDate = undefined;
                }

                const run = questKey.Progress[0]?.c ?? 0;
                const stage = questKey.Progress.map(p => p.c).lastIndexOf(run);

                if (run > 0) {
                    questKey.Progress[stage].c = run - 1;
                } else {
                    questKey.Progress.pop();
                }

                if (stage > 0) {
                    await giveKeyChainStageTriggered(inventory, {
                        KeyChain: questKey.ItemType,
                        ChainStage: stage - 1
                    });
                }
                modified = await saveOnDemand(inventory);
            }
            break;
        }
        case "nextStage": {
            if (allQuestKeys.includes(questItemType)) {
                const inventory = await getInventory(accountId, undefined);
                const questKey = inventory.QuestKeys.find(key => key.ItemType === questItemType);
                const questManifest = getKey(questItemType, BL_LATEST);
                if (!questKey) {
                    logger.error(`Quest key not found in inventory: ${questItemType}`);
                    break;
                }
                if (!questKey.Progress || !questManifest?.chainStages) break;

                const run = questKey.Progress[0]?.c ?? 0;
                const currentStage = questKey.Progress.map(p => p.c).lastIndexOf(run);

                if (currentStage + 1 == questManifest.chainStages.length) {
                    logger.debug(`Trying to complete last stage with nextStage, calling completeQuest instead`);
                    await completeQuest(inventory, questKey.ItemType, BL_LATEST, true);
                } else {
                    if (run > 0) {
                        questKey.Progress[currentStage + 1].c = run;
                    } else {
                        questKey.Progress.push({ c: run, i: false, m: false, b: [] });
                    }

                    await giveKeyChainStageTriggered(inventory, {
                        KeyChain: questKey.ItemType,
                        ChainStage: currentStage + 1
                    });

                    if (currentStage > 0) {
                        await giveKeyChainMissionReward(
                            inventory,
                            {
                                KeyChain: questKey.ItemType,
                                ChainStage: currentStage
                            },
                            BL_LATEST
                        );
                    }
                }
                modified = await saveOnDemand(inventory);
            }
            break;
        }
        case "setInactive": {
            const inventory = await getInventory2(accountId, "ActiveQuest");
            inventory.ActiveQuest = "";
            modified = await saveOnDemand(inventory);
            break;
        }
    }

    res.json(modified);
    if (modified) {
        broadcastInventoryUpdate(req);
    }
};

const saveOnDemand = async (inventory: Pick<TInventoryDatabaseDocument, "isModified" | "save">): Promise<boolean> => {
    if (inventory.isModified()) {
        await inventory.save();
        return true;
    }
    return false;
};
