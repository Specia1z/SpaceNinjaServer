import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IAffiliationMods, IInventoryChanges } from "../types/purchaseTypes.ts";
import type { IDailyAffiliations } from "../types/inventoryTypes/inventoryTypes.ts";
import type { TStandingLimitBin } from "warframe-public-export-plus";
import { getMaxStanding, getMinStanding } from "../helpers/syndicateStandingHelper.ts";
import { getSyndicate } from "./itemDataService.ts";
import { logger } from "../utils/logger.ts";

export const CurrencyType = {
    CREDITS: false,
    PLATINUM: true,
    PAID_PLATINUM: 2
} as const;

type TCurrencyType = (typeof CurrencyType)[keyof typeof CurrencyType];

export const updateCurrency = (
    inventory: TInventoryDatabaseDocument,
    price: number,
    currencyType: TCurrencyType,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    return currencyType == CurrencyType.CREDITS
        ? updateCredits(inventory, price, inventoryChanges)
        : updatePlatinum(inventory, price, currencyType == CurrencyType.PAID_PLATINUM, inventoryChanges);
};

export const updateCredits = (
    inventory: Pick<TInventoryDatabaseDocument, "infiniteCredits" | "RegularCredits">,
    price: number,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    if (price != 0 && !inventory.infiniteCredits) {
        if (price > inventory.RegularCredits) {
            throw new Error(`Cannot subtract ${price} credits, would be left with ${inventory.RegularCredits - price}`);
        }
        inventoryChanges.RegularCredits ??= 0;
        inventoryChanges.RegularCredits -= price;
        inventory.RegularCredits -= price;
        logger.debug(`currency changes`, { RegularCredits: -price });
    }
    return inventoryChanges;
};

export const updatePlatinum = (
    inventory: Pick<TInventoryDatabaseDocument, "infinitePlatinum" | "PremiumCreditsFree" | "PremiumCredits">,
    price: number,
    mustBePaidPlatinum?: boolean,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    if (price != 0 && !inventory.infinitePlatinum) {
        if (price > 0) {
            if (mustBePaidPlatinum) {
                const paidPlatinumBalance = inventory.PremiumCredits - inventory.PremiumCreditsFree;
                if (price > paidPlatinumBalance) {
                    throw new Error(
                        `Cannot subtract ${price} paid platinum, would be left with ${paidPlatinumBalance - price}`
                    );
                }
            } else if (inventory.PremiumCreditsFree > 0) {
                const premiumCreditsFreeDelta = Math.min(price, inventory.PremiumCreditsFree) * -1;
                inventoryChanges.PremiumCreditsFree ??= 0;
                inventoryChanges.PremiumCreditsFree += premiumCreditsFreeDelta;
                inventory.PremiumCreditsFree += premiumCreditsFreeDelta;
                logger.debug(`spending ${-premiumCreditsFreeDelta} starter plat`);
            }
            if (price > inventory.PremiumCredits) {
                throw new Error(
                    `Cannot subtract ${price} platinum, would be left with ${inventory.PremiumCredits - price}`
                );
            }
        }
        inventoryChanges.PremiumCredits ??= 0;
        inventoryChanges.PremiumCredits -= price;
        inventory.PremiumCredits -= price;
        logger.debug(`currency changes`, { PremiumCredits: -price });
    }
    return inventoryChanges;
};

export const addFusionPoints = (
    inventory: Pick<TInventoryDatabaseDocument, "infiniteEndo" | "FusionPoints">,
    add: number
): number => {
    if (inventory.infiniteEndo) {
        add = 0;
    } else {
        if (inventory.FusionPoints + add > 2147483647) {
            logger.warn(`capping FusionPoints balance at 2147483647`);
            add = 2147483647 - inventory.FusionPoints;
        }
        inventory.FusionPoints += add;
    }
    return add;
};

export const addCrewShipFusionPoints = (
    inventory: Pick<TInventoryDatabaseDocument, "infiniteDirac" | "CrewShipFusionPoints">,
    add: number
): number => {
    if (inventory.infiniteDirac) {
        add = 0;
    } else {
        if (inventory.CrewShipFusionPoints + add > 2147483647) {
            logger.warn(`capping CrewShipFusionPoints balance at 2147483647`);
            add = 2147483647 - inventory.CrewShipFusionPoints;
        }
        inventory.CrewShipFusionPoints += add;
    }
    return add;
};

const standingLimitBinToInventoryKey: Record<
    Exclude<TStandingLimitBin, "STANDING_LIMIT_BIN_NONE">,
    keyof IDailyAffiliations
> = {
    STANDING_LIMIT_BIN_NORMAL: "DailyAffiliation",
    STANDING_LIMIT_BIN_PVP: "DailyAffiliationPvp",
    STANDING_LIMIT_BIN_LIBRARY: "DailyAffiliationLibrary",
    STANDING_LIMIT_BIN_CETUS: "DailyAffiliationCetus",
    STANDING_LIMIT_BIN_QUILLS: "DailyAffiliationQuills",
    STANDING_LIMIT_BIN_SOLARIS: "DailyAffiliationSolaris",
    STANDING_LIMIT_BIN_VENTKIDS: "DailyAffiliationVentkids",
    STANDING_LIMIT_BIN_VOX: "DailyAffiliationVox",
    STANDING_LIMIT_BIN_ENTRATI: "DailyAffiliationEntrati",
    STANDING_LIMIT_BIN_NECRALOID: "DailyAffiliationNecraloid",
    STANDING_LIMIT_BIN_ZARIMAN: "DailyAffiliationZariman",
    STANDING_LIMIT_BIN_KAHL: "DailyAffiliationKahl",
    STANDING_LIMIT_BIN_CAVIA: "DailyAffiliationCavia",
    STANDING_LIMIT_BIN_HEX: "DailyAffiliationHex"
};

export const allDailyAffiliationKeys: (keyof IDailyAffiliations)[] = Object.values(standingLimitBinToInventoryKey);

const getStandingLimit = (inventory: TInventoryDatabaseDocument, bin: TStandingLimitBin): number =>
    bin == "STANDING_LIMIT_BIN_NONE" || inventory.noDailyStandingLimits
        ? Number.MAX_SAFE_INTEGER
        : inventory[standingLimitBinToInventoryKey[bin]];

const updateStandingLimit = (
    inventory: TInventoryDatabaseDocument,
    bin: TStandingLimitBin,
    subtrahend: number
): void => {
    if (bin != "STANDING_LIMIT_BIN_NONE" && !inventory.noDailyStandingLimits) {
        inventory[standingLimitBinToInventoryKey[bin]] -= subtrahend;
    }
};

export const eStandingSource = {
    Medallion: 0b101,
    Alignment: 0b010,
    Misc: 0b011
};
type TStandingSource = (typeof eStandingSource)[keyof typeof eStandingSource];

export const addStanding = async (
    inventory: TInventoryDatabaseDocument,
    buildLabel: string,
    syndicateTag: string,
    gainedStanding: number,
    affiliationMods: IAffiliationMods[] = [],
    source: TStandingSource = eStandingSource.Misc
): Promise<void> => {
    let syndicate = inventory.Affiliations.find(x => x.Tag == syndicateTag);
    const syndicateMeta = (await getSyndicate(syndicateTag, buildLabel))!;

    if (!syndicate) {
        syndicate =
            inventory.Affiliations[inventory.Affiliations.push({ Tag: syndicateTag, Standing: 0, Title: 0 }) - 1];
    }

    const max = getMaxStanding(syndicateMeta, syndicate.Title ?? 0);
    if (syndicate.Standing + gainedStanding > max) gainedStanding = max - syndicate.Standing;
    if (syndicate.Standing + gainedStanding < -71000) gainedStanding = -71000 - syndicate.Standing;

    if ((source == eStandingSource.Medallion && syndicateMeta.medallionsCappedByDailyLimit) || source & 0b010) {
        const standingLimit = getStandingLimit(inventory, syndicateMeta.dailyLimitBin);
        if (gainedStanding > standingLimit) gainedStanding = standingLimit;
        updateStandingLimit(inventory, syndicateMeta.dailyLimitBin, gainedStanding);
    }

    syndicate.Standing += gainedStanding;
    const affiliationMod: IAffiliationMods = { Tag: syndicateTag, Standing: gainedStanding };
    affiliationMods.push(affiliationMod);

    if (syndicateMeta.alignments) {
        if (source & 0b001) {
            for (const [tag, factor] of Object.entries(syndicateMeta.alignments)) {
                await addStanding(
                    inventory,
                    buildLabel,
                    tag,
                    gainedStanding * factor,
                    affiliationMods,
                    eStandingSource.Alignment
                );
            }
        } else {
            while (syndicate.Standing < getMinStanding(syndicateMeta, syndicate.Title ?? 0)) {
                syndicate.Title ??= 0;
                syndicate.Title -= 1;
                affiliationMod.Title ??= 0;
                affiliationMod.Title -= 1;
                logger.debug(`${syndicateTag} is decreasing to title ${syndicate.Title} after applying alignment`);
            }
        }
    }
};
