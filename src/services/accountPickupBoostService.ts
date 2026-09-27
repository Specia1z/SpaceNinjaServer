import type { IWorldState } from "../types/worldStateTypes.ts";
import { toMongoDate2, toOid2, fromOid } from "../helpers/inventoryHelpers.ts";
import { buildVersionToInt } from "../helpers/versionHelper.ts";

const globalResourceUpgradeId = "5b23106f283a555109666674";

/** Apply a per-account client pickup bonus without changing the shared world state or inventory boosters. */
export const applyAccountPickupBoost = (
    worldState: Pick<IWorldState, "GlobalUpgrades">,
    buildLabel: string,
    multiplier: number
): void => {
    if (multiplier == 1) return;

    // Preserve the global event effect, if any, and compound it with the account-specific bonus.
    const globalUpgrade = worldState.GlobalUpgrades.find(upgrade => fromOid(upgrade._id) == globalResourceUpgradeId);
    if (globalUpgrade) {
        globalUpgrade.Value *= multiplier;
        return;
    }

    const buildVersion = buildVersionToInt(buildLabel);
    worldState.GlobalUpgrades.push({
        _id: toOid2("5b23106f283a555109666675", buildVersion),
        Activation: toMongoDate2(1740164400000, buildVersion),
        ExpiryDate: toMongoDate2(2000000000000, buildVersion),
        UpgradeType: "GAMEPLAY_PICKUP_AMOUNT",
        OperationType: "MULTIPLY",
        Value: multiplier,
        LocalizeTag: "",
        LocalizeDescTag: ""
    });
};
