import type { RequestHandler } from "express";
import { getAccountForRequest, getBuildLabel } from "../../services/loginService.ts";
import { addMiscItems, getInventory } from "../../services/inventoryService.ts";
import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import {
    createUnveiledRivenFingerprint,
    getRivenRerollCost,
    randomiseRivenStats,
    type RivenFingerprint
} from "../../helpers/rivenHelper.ts";
import { ExportUpgrades } from "warframe-public-export-plus";
import type { IOidWithLegacySupport } from "../../types/commonTypes.ts";
import { toObjectId, toOid2 } from "../../helpers/inventoryHelpers.ts";

export const rerollRandomModController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const request = getJSONfromString<RerollRandomModRequest>(String(req.body));
    if ("ItemIds" in request) {
        const buildLabel = getBuildLabel(req, account);
        const inventory = await getInventory(account._id, "Upgrades MiscItems dontSubtractKuvaForRivens");
        const changes: IChange[] = [];
        let totalKuvaCost = 0;
        request.ItemIds.forEach(itemId => {
            const upgrade = inventory.Upgrades.id(itemId)!;
            const fingerprint = JSON.parse(upgrade.UpgradeFingerprint!) as RivenFingerprint;
            if ("challenge" in fingerprint) {
                upgrade.UpgradeFingerprint = JSON.stringify(
                    createUnveiledRivenFingerprint(ExportUpgrades[upgrade.ItemType], fingerprint.IsSentinel)
                );
            } else {
                fingerprint.rerolls ??= 0;
                if (!inventory.dontSubtractKuvaForRivens) {
                    const kuvaCost = getRivenRerollCost(fingerprint.rerolls, !!request.LockedTraits?.length);
                    totalKuvaCost += kuvaCost;
                    addMiscItems(inventory, [
                        {
                            ItemType: "/Lotus/Types/Items/MiscItems/Kuva",
                            ItemCount: kuvaCost * -1
                        }
                    ]);
                }

                fingerprint.rerolls++;
                upgrade.UpgradeFingerprint = JSON.stringify(fingerprint);

                randomiseRivenStats(ExportUpgrades[upgrade.ItemType], fingerprint, request.LockedTraits);
                upgrade.PendingRerollFingerprint = JSON.stringify(fingerprint);
            }

            changes.push({
                ItemId: toOid2(toObjectId(itemId), buildLabel),
                UpgradeFingerprint: upgrade.UpgradeFingerprint,
                PendingRerollFingerprint: upgrade.PendingRerollFingerprint
            });
        });

        await inventory.save();

        res.json({
            changes: changes,
            cost: totalKuvaCost
        });
    } else {
        const inventory = await getInventory(account._id, "Upgrades");
        const upgrade = inventory.Upgrades.id(request.ItemId)!;
        if (request.CommitReroll && upgrade.PendingRerollFingerprint) {
            upgrade.UpgradeFingerprint = upgrade.PendingRerollFingerprint;
        }
        upgrade.PendingRerollFingerprint = undefined;
        await inventory.save();
        res.send(upgrade.UpgradeFingerprint);
    }
};

type RerollRandomModRequest = LetsGoGamblingRequest | AwDangitRequest;

interface LetsGoGamblingRequest {
    ItemIds: string[];
    LockedTraits?: string[];
}

interface AwDangitRequest {
    ItemId: string;
    CommitReroll: boolean;
}

interface IChange {
    ItemId: IOidWithLegacySupport;
    UpgradeFingerprint?: string;
    PendingRerollFingerprint?: string;
}
