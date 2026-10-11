import type { Types } from "mongoose";
import type { ICountedItem } from "warframe-public-export-plus";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import { Inbox } from "../models/inboxModel.ts";
import { getInvasionByOid } from "./worldStateService.ts";
import { addItem } from "./inventoryService.ts";
import { createMessage } from "./inboxService.ts";
import { claimInvasionReward, type TInvasionRewardClaimResult } from "./invasionRewardClaimService.ts";
import { logger } from "../utils/logger.ts";

export type TClaimedInvasionReward = Extract<TInvasionRewardClaimResult, { status: "claimed" }>;

export const processInvasionRewards = async (
    accountId: Types.ObjectId,
    buildLabel: string,
    inventory: TInventoryDatabaseDocument
): Promise<TClaimedInvasionReward[]> => {
    const completedClaims: TClaimedInvasionReward[] = [];

    for (let i = 0; i != inventory.QualifyingInvasions.length; ) {
        const qualifyingInvasion = inventory.QualifyingInvasions[i];
        const invasionId = qualifyingInvasion.invasionId.toString();
        const invasion = getInvasionByOid(invasionId);
        if (!invasion) {
            logger.debug(`removing QualifyingInvasions entry for unknown invasion: ${invasionId}`);
            inventory.QualifyingInvasions.splice(i, 1);
            continue;
        }
        if (!invasion.Completed) {
            ++i;
            continue;
        }

        let factionSidedWith: string | undefined;
        let battlePay: readonly ICountedItem[] | undefined;
        if (qualifyingInvasion.AttackerScore >= 3) {
            factionSidedWith = invasion.Faction;
            battlePay = invasion.AttackerReward.countedItems;
        } else if (qualifyingInvasion.DefenderScore >= 3) {
            factionSidedWith = invasion.DefenderFaction;
            battlePay = invasion.DefenderReward.countedItems;
        }

        if (factionSidedWith && battlePay) {
            const claim = await claimInvasionReward(accountId, invasionId);
            if (claim.status == "busy") {
                ++i;
                continue;
            }
            if (claim.status == "completed") {
                inventory.QualifyingInvasions.splice(i, 1);
                continue;
            }

            logger.debug(`invasion pay from ${factionSidedWith}`, { battlePay });
            const messageContext = `invasion-reward:${invasionId}`;
            const rewardMessageExists = await Inbox.exists({ ownerId: accountId, contextInfo: messageContext });
            if (!rewardMessageExists) {
                // Decoupling rewards from the inbox message because it may delete itself without being read.
                for (const item of battlePay) {
                    await addItem(
                        inventory,
                        item.ItemType,
                        item.ItemCount,
                        false,
                        undefined,
                        undefined,
                        false,
                        buildLabel
                    );
                }
                await createMessage(accountId, [
                    {
                        sndr:
                            factionSidedWith == "FC_GRINEER"
                                ? "/Lotus/Language/Menu/GrineerInvasionLeader"
                                : "/Lotus/Language/Menu/CorpusInvasionLeader",
                        msg: `/Lotus/Language/G1Quests/${factionSidedWith}_InvasionThankyouMessageBody`,
                        sub: `/Lotus/Language/G1Quests/${factionSidedWith}_InvasionThankyouMessageSubject`,
                        countedAtt: battlePay,
                        attVisualOnly: true,
                        contextInfo: messageContext,
                        icon:
                            factionSidedWith == "FC_GRINEER"
                                ? "/Lotus/Interface/Icons/Npcs/EliteRifleLancerAvatar.png" // Source: https://www.reddit.com/r/Warframe/comments/1aj4usx/battle_pay_worth_10_plat/, https://www.youtube.com/watch?v=XhNZ6ai6BOY
                                : "/Lotus/Interface/Icons/Npcs/CrewmanNormal.png", // My best source for this is https://www.youtube.com/watch?v=rxrCCFm73XE around 1:37
                        // TOVERIFY: highPriority?
                        endDate: new Date(Date.now() + 86400_000) // TOVERIFY: This type of inbox message seems to automatically delete itself. We'll just delete it after 24 hours, but it's not clear if this is correct.
                    }
                ]);
            }
            completedClaims.push(claim);
        }

        logger.debug(`removing QualifyingInvasions entry for completed invasion: ${invasionId}`);
        inventory.QualifyingInvasions.splice(i, 1);
    }

    return completedClaims;
};
