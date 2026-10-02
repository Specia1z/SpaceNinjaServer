import type { RequestHandler } from "express";
import { getAccountIdForRequest } from "../../services/loginService.ts";
import { addMiscItems, getInventory2, updatePlatinum } from "../../services/inventoryService.ts";
import type { IInventoryChanges } from "../../types/purchaseTypes.ts";
import type { IMiscItem } from "../../types/inventoryTypes/inventoryTypes.ts";
import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import { isVeiledRivenFingerprint } from "../../helpers/rivenHelper.ts";

export const completeRandomModChallengeController: RequestHandler = async (req, res) => {
    const accountId = await getAccountIdForRequest(req);
    const inventory = await getInventory2(
        accountId,
        "infinitePlatinum",
        "PremiumCreditsFree",
        "PremiumCredits",
        "MiscItems",
        "Upgrades"
    );
    const request = getJSONfromString<ICompleteRandomModChallengeRequest>(String(req.body));
    const upgrade = inventory.Upgrades.id(request.ItemId);
    if (!upgrade) {
        res.status(400).json({ error: "Random mod not found" });
        return;
    }

    if (!upgrade.UpgradeFingerprint) {
        res.status(400).json({ error: "Random mod has no fingerprint" });
        return;
    }

    let fingerprint: unknown;
    try {
        fingerprint = JSON.parse(upgrade.UpgradeFingerprint);
    } catch {
        res.status(400).json({ error: "Random mod fingerprint is invalid" });
        return;
    }

    if (!isVeiledRivenFingerprint(fingerprint)) {
        res.status(400).json({ error: "Random mod challenge is not active" });
        return;
    }

    let inventoryChanges: IInventoryChanges = {};

    // Remove 20 plat or riven cipher
    if ((req.query.p as string) == "1") {
        inventoryChanges = { ...updatePlatinum(inventory, 20) };
    } else {
        const miscItemChanges: IMiscItem[] = [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/RivenIdentifier",
                ItemCount: -1
            }
        ];
        addMiscItems(inventory, miscItemChanges);
        inventoryChanges.MiscItems = miscItemChanges;
    }

    // Complete the riven challenge
    fingerprint.challenge.Progress = fingerprint.challenge.Required;
    upgrade.UpgradeFingerprint = JSON.stringify(fingerprint);

    await inventory.save();

    res.json({
        InventoryChanges: inventoryChanges,
        Fingerprint: upgrade.UpgradeFingerprint
    });
};

interface ICompleteRandomModChallengeRequest {
    ItemId: string;
}
