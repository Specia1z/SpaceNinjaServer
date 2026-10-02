import type { RequestHandler } from "express";
import { getAccountForRequest, getBuildLabel } from "../../services/loginService.ts";
import { addMiscItems, getInventory } from "../../services/inventoryService.ts";
import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import {
    createUnveiledRivenFingerprint,
    getLockedTraitValidationError,
    getLockedTraitRequestValidationError,
    getRivenRerollCost,
    isUnveiledRivenFingerprint,
    isVeiledRivenFingerprint,
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
        const requestValidationError = getLockedTraitRequestValidationError(request.LockedTraits);
        if (requestValidationError) {
            res.status(400).json({ error: requestValidationError });
            return;
        }

        const buildLabel = getBuildLabel(req, account);
        const inventory = await getInventory(account._id, "Upgrades MiscItems dontSubtractKuvaForRivens");
        const prepared = [] as {
            itemId: string;
            upgrade: NonNullable<ReturnType<typeof inventory.Upgrades.id>>;
            fingerprint: RivenFingerprint;
        }[];

        for (const itemId of request.ItemIds) {
            const upgrade = inventory.Upgrades.id(itemId);
            if (!upgrade || !upgrade.UpgradeFingerprint) {
                res.status(400).json({ error: "Random mod or fingerprint not found" });
                return;
            }

            let fingerprint: unknown;
            try {
                fingerprint = JSON.parse(upgrade.UpgradeFingerprint);
            } catch {
                res.status(400).json({ error: "Random mod fingerprint is invalid" });
                return;
            }

            if (!isVeiledRivenFingerprint(fingerprint) && !isUnveiledRivenFingerprint(fingerprint)) {
                res.status(400).json({ error: "Random mod fingerprint is invalid" });
                return;
            }

            if (isUnveiledRivenFingerprint(fingerprint)) {
                const validationError = getLockedTraitValidationError(fingerprint, request.LockedTraits);
                if (validationError) {
                    res.status(400).json({ error: validationError });
                    return;
                }
            }

            prepared.push({ itemId, upgrade, fingerprint });
        }

        const changes: IChange[] = [];
        let totalKuvaCost = 0;
        prepared.forEach(({ itemId, upgrade, fingerprint }) => {
            if (isVeiledRivenFingerprint(fingerprint)) {
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
