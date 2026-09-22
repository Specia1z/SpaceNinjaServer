import { getInventory } from "../../services/inventoryService.ts";
import { getAccountIdForRequest } from "../../services/loginService.ts";
import { completeAllMissions } from "../../services/accountInitializationService.ts";
import type { RequestHandler } from "express";

export const completeAllMissionsController: RequestHandler = async (req, res) => {
    const includeSteelPath = req.query.normalOnly != "1";
    const accountId = await getAccountIdForRequest(req);
    const inventory = await getInventory(accountId, undefined);
    await completeAllMissions(inventory, includeSteelPath);
    await inventory.save();
    res.end();
};
