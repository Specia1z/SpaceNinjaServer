import type { IWorldState } from "../types/worldStateTypes.ts";
import { toMongoDate2, toOid2, fromOid, fromMongoDate } from "../helpers/inventoryHelpers.ts";
import { buildVersionToInt } from "../helpers/versionHelper.ts";

type TAccountUpgrade = "resource" | "credit" | "affinity";
const accountUpgrades: Record<TAccountUpgrade, { globalId: string; accountId: string; upgradeType: string }> = {
    resource: {
        globalId: "5b23106f283a555109666674",
        accountId: "5b23106f283a555109666675",
        upgradeType: "GAMEPLAY_PICKUP_AMOUNT"
    },
    credit: {
        globalId: "5b23106f283a555109666672",
        accountId: "5b23106f283a555109666676",
        upgradeType: "GAMEPLAY_MONEY_REWARD_AMOUNT"
    },
    affinity: {
        globalId: "5b23106f283a555109666673",
        accountId: "5b23106f283a555109666677",
        upgradeType: "GAMEPLAY_KILL_XP_AMOUNT"
    }
};

/** Apply an account-only client boost without modifying shared world state or inventory boosters. */
export const applyAccountWorldStateBoost = (
    worldState: Pick<IWorldState, "GlobalUpgrades">,
    buildLabel: string,
    kind: TAccountUpgrade,
    multiplier: number,
    expiresAt?: string
): void => {
    if (multiplier == 1) return;

    const definition = accountUpgrades[kind];
    // Preserve the global event effect, if any, and compound it with the account-specific bonus.
    const globalUpgrade = worldState.GlobalUpgrades.find(upgrade => fromOid(upgrade._id) == definition.globalId);
    if (globalUpgrade) {
        globalUpgrade.Value *= multiplier;
        if (expiresAt) {
            // The combined value must not outlive the account rate, or it displays the global event's distant expiry.
            globalUpgrade.ExpiryDate = toMongoDate2(
                Math.min(fromMongoDate(globalUpgrade.ExpiryDate).getTime(), Date.parse(expiresAt)),
                buildLabel
            );
        }
        return;
    }

    const buildVersion = buildVersionToInt(buildLabel);
    worldState.GlobalUpgrades.push({
        _id: toOid2(definition.accountId, buildVersion),
        Activation: toMongoDate2(1740164400000, buildVersion),
        ExpiryDate: toMongoDate2(expiresAt ? Date.parse(expiresAt) : 2000000000000, buildVersion),
        UpgradeType: definition.upgradeType,
        OperationType: "MULTIPLY",
        Value: multiplier,
        LocalizeTag: "",
        LocalizeDescTag: ""
    });
};

/** Retained for existing resource pickup users. */
export const applyAccountPickupBoost = (
    worldState: Pick<IWorldState, "GlobalUpgrades">,
    buildLabel: string,
    multiplier: number,
    expiresAt?: string
): void => applyAccountWorldStateBoost(worldState, buildLabel, "resource", multiplier, expiresAt);
