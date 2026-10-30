import type { RequestHandler } from "express";
import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import { getAccountForRequest, getBuildLabel } from "../../services/loginService.ts";
import type { IMissionInventoryUpdateRequest } from "../../types/requestTypes.ts";
import {
    addFailedArbitrationRewards,
    addMissionInventoryUpdates,
    addMissionRewards,
    handleConservation
} from "../../services/missionInventoryUpdateService.ts";
import { isArbitrationMission } from "../../services/missionRewardService.ts";
import {
    combineInventoryChanges,
    dispatchPendingPremiumCredits,
    getInventory
} from "../../services/inventoryService.ts";
import {
    clampMissionCompletes,
    isAntiCheatEnforcing,
    isAntiCheatSanitizing,
    verifyClientInventoryUpdates,
    verifyMissionTimes,
    verifyRewardSeed,
    verifyXpGain
} from "../../services/antiCheatService.ts";
import { getInventoryResponse } from "./inventoryController.ts";
import { logger } from "../../utils/logger.ts";
import type {
    IMissionInventoryUpdateResponse,
    IMissionInventoryUpdateResponseBackToDryDock,
    IMissionInventoryUpdateResponseRailjackInterstitial
} from "../../types/missionTypes.ts";
import { sendWsBroadcastTo } from "../../services/wsService.ts";
import { generateRewardSeed } from "../../services/rngService.ts";
import { version_compare } from "../../helpers/inventoryHelpers.ts";
import gameToBuildVersion from "../../constants/gameToBuildVersion.ts";
import { filterInplace } from "../../helpers/general.ts";
import crypto from "node:crypto";
import { getAccountRateProfile, getEffectiveAccountRate } from "../../services/accountRateService.ts";
import { markPresenceMission } from "../../services/presenceService.ts";
import {
    claimMissionSettlement,
    completeMissionSettlementClaim,
    getMissionSettlementKey,
    type TClaimedMissionSettlement
} from "../../services/missionSettlementClaimService.ts";

/*
**** INPUT ****
- [ ]  crossPlaySetting
- [ ]  rewardsMultiplier
- [ ]  ActiveBoosters
- [x]  LongGuns
- [x]  Pistols
- [x]  Suits
- [x]  Melee
- [x]  RawUpgrades
- [x]  MiscItems
- [x]  RegularCredits
- [ ]  RandomUpgradesIdentified
- [ ]  MissionFailed
- [ ]  MissionStatus
- [ ]  CurrentLoadOutIds
- [x]  AliveTime (反作弊校验用，见 antiCheatService)
- [x]  MissionTime (反作弊校验用，见 antiCheatService)
- [x]  Missions
- [ ]  CompletedAlerts
- [ ]  LastRegionPlayed
- [ ]  GameModeId
- [ ]  hosts
- [x]  ChallengeProgress
- [ ]  SeasonChallengeHistory
- [ ]  PS (anticheat data)
- [ ]  ActiveDojoColorResearch
- [x]  RewardInfo
- [ ]  ReceivedCeremonyMsg
- [ ]  LastCeremonyResetDate
- [ ]  MissionPTS (Used to validate the mission/alive time above.)
- [ ]  RepHash
- [ ]  EndOfMatchUpload
- [ ]  ObjectiveReached
- [ ]  FpsAvg
- [ ]  FpsMin
- [ ]  FpsMax
- [ ]  FpsSamples
*/
//move credit calc in here, return MissionRewards: [] if no reward info
export const missionInventoryUpdateController: RequestHandler = async (req, res): Promise<void> => {
    const account = await getAccountForRequest(req);
    const buildLabel = getBuildLabel(req, account);
    const requestId = crypto.randomUUID();
    const antiCheatContext = {
        requestId,
        buildLabel,
        // Some controller-level test requests do not provide Express' socket object.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        remoteAddress: req.ip ?? req.socket?.remoteAddress
    };
    const missionReport = getJSONfromString<IMissionInventoryUpdateRequest>((req.body as string).toString());
    await markPresenceMission(account._id, account.DisplayName, buildLabel, missionReport);
    logger.debug("mission report", {
        requestId,
        account: account._id.toString(),
        buildLabel,
        report: missionReport
    });

    let inventory = await getInventory(account._id, undefined);
    const firstCompletion = missionReport.SortieId
        ? inventory.CompletedSorties.indexOf(missionReport.SortieId) == -1
        : false;

    // 反作弊：先判定再落库。observe 只记录；sanitize 修正可安全限幅的字段；reject 丢弃整份可疑结算。
    const missionTimesOk = verifyMissionTimes(account, missionReport, antiCheatContext);
    const rewardSeedOk = await verifyRewardSeed(account, missionReport, inventory, antiCheatContext);
    const clientInventoryUpdatesOk = verifyClientInventoryUpdates(account, missionReport, antiCheatContext);
    const xpGainOk = verifyXpGain(account, missionReport, antiCheatContext);
    const missionCompletesOk = clampMissionCompletes(account, missionReport, antiCheatContext);

    if (
        isAntiCheatEnforcing() &&
        (!missionTimesOk || !rewardSeedOk || !clientInventoryUpdatesOk || !xpGainOk || !missionCompletesOk)
    ) {
        const failedChecks = [
            !missionTimesOk && "missionTimes",
            !rewardSeedOk && "rewardSeed",
            !clientInventoryUpdatesOk && "clientInventoryUpdates",
            !xpGainOk && "xpGain",
            !missionCompletesOk && "missionCompletes"
        ].filter((check): check is string => Boolean(check));
        // 拒绝整份报文：连客户端自带的 RegularCredits / MiscItems 也一并丢弃，不做部分入库。
        logger.warn(`[anti-cheat] settlementRejected`, {
            requestId,
            account: account._id.toString(),
            displayName: account.DisplayName,
            buildLabel,
            failedChecks,
            missionTag: missionReport.Missions?.Tag ?? missionReport.RewardInfo?.node,
            sessionId: missionReport.sharedSessionId || undefined
        });
        if (missionReport.EndOfMatchUpload || missionReport.RJ) {
            inventory.RewardSeed = generateRewardSeed();
        }
        await inventory.save();
        const inventoryResponse = await getInventoryResponse(req, inventory, true, buildLabel);
        res.json({
            InventoryJson: JSON.stringify(inventoryResponse),
            MissionRewards: []
        });
        sendWsBroadcastTo(account._id.toString(), { update_inventory: true });
        return;
    }

    if (isAntiCheatSanitizing() && !missionTimesOk) {
        // A failed-time report is sanitized as a failed mission. Skip every client-supplied delta here,
        // including secondary progress fields that are unrelated to the usual reward and inventory lists.
        logger.info(`[anti-cheat] settlementSanitized`, {
            requestId,
            account: account._id.toString(),
            displayName: account.DisplayName,
            buildLabel,
            reason: "impossibleMissionTime",
            missionTag: missionReport.Missions?.Tag ?? missionReport.RewardInfo?.node,
            sessionId: missionReport.sharedSessionId || undefined
        });
        if (missionReport.EndOfMatchUpload || missionReport.RJ) {
            inventory.RewardSeed = generateRewardSeed();
        }
        await inventory.save();
        const inventoryResponse = await getInventoryResponse(req, inventory, true, buildLabel);
        res.json({
            InventoryJson: JSON.stringify(inventoryResponse),
            MissionRewards: []
        });
        sendWsBroadcastTo(account._id.toString(), { update_inventory: true });
        return;
    }

    const respondWithoutSettlementRewards = async (): Promise<void> => {
        inventory = await getInventory(account._id, undefined);
        const isInterstitial = Boolean(
            missionReport.BMI ||
            missionReport.TNT ||
            missionReport.SSC ||
            missionReport.RJ ||
            missionReport.SS ||
            missionReport.CMI ||
            missionReport.EJC
        );
        if (isInterstitial) {
            res.json({ MissionRewards: [] });
        } else if (missionReport.RewardInfo) {
            const response: IMissionInventoryUpdateResponse = { MissionRewards: [] };
            if (version_compare(buildLabel, gameToBuildVersion["8.0.0"]) > 0) {
                response.InventoryJson = JSON.stringify(
                    await getInventoryResponse(req, inventory, "xpBasedLevelCapDisabled" in req.query, buildLabel)
                );
            }
            if (
                missionReport.RewardInfo.sortieTag == "Final" &&
                missionReport.SortieId &&
                inventory.CompletedSorties.includes(missionReport.SortieId)
            ) {
                response.CompletedSortie = true;
            }
            res.json(response);
        } else if (version_compare(buildLabel, gameToBuildVersion["8.0.0"]) > 0) {
            res.json({
                InventoryJson: JSON.stringify(
                    await getInventoryResponse(req, inventory, "xpBasedLevelCapDisabled" in req.query, buildLabel)
                )
            } satisfies IMissionInventoryUpdateResponseBackToDryDock);
        } else {
            res.json({});
        }
        sendWsBroadcastTo(account._id.toString(), { update_inventory: true });
    };

    let settlementClaim: TClaimedMissionSettlement | undefined;
    if (missionReport.EndOfMatchUpload === true || missionReport.RewardInfo !== undefined) {
        const settlementKey = getMissionSettlementKey(missionReport);
        if (!settlementKey) {
            logger.warn("rejecting mission settlement without a stable identity", {
                requestId,
                account: account._id.toString(),
                buildLabel,
                sessionId: missionReport.sharedSessionId || undefined,
                missionTag: missionReport.Missions?.Tag ?? missionReport.RewardInfo?.node
            });
            await respondWithoutSettlementRewards();
            return;
        }

        const claim = await claimMissionSettlement(account._id, settlementKey);
        if (claim.status != "claimed") {
            logger.info("ignoring duplicate mission settlement", {
                requestId,
                account: account._id.toString(),
                settlementKey,
                claimStatus: claim.status
            });
            await respondWithoutSettlementRewards();
            return;
        }
        settlementClaim = claim;
    }

    const inventoryUpdates = await addMissionInventoryUpdates(account, buildLabel, inventory, missionReport);

    if (missionReport.MissionStatus ? missionReport.MissionStatus !== "GS_SUCCESS" : missionReport.MissionFailed) {
        logger.debug(`aborted or failed mission, syncing inventory`);
        let MissionRewards: IMissionInventoryUpdateResponse["MissionRewards"] = [];
        if (
            (missionReport.MissionStatus == "GS_FAILURE" ||
                (missionReport.MissionStatus === undefined && missionReport.MissionFailed)) &&
            missionReport.RewardInfo &&
            isArbitrationMission(missionReport.RewardInfo)
        ) {
            const rewards = await addFailedArbitrationRewards(account, buildLabel, inventory, missionReport.RewardInfo);
            MissionRewards = rewards.MissionRewards;
            combineInventoryChanges(inventoryUpdates.InventoryChanges, rewards.inventoryChanges);
        }
        if (missionReport.EndOfMatchUpload || missionReport.RJ) {
            logger.debug(`refreshing reward seed`);
            inventory.RewardSeed = generateRewardSeed();
        }
        await inventory.save();
        if (settlementClaim) await completeMissionSettlementClaim(settlementClaim);
        const inventoryResponse = await getInventoryResponse(req, inventory, true, buildLabel);
        const failureResponse: IMissionInventoryUpdateResponse = {
            InventoryJson: JSON.stringify(inventoryResponse),
            MissionRewards
        };
        if (MissionRewards.length) failureResponse.InventoryChanges = inventoryUpdates.InventoryChanges;
        res.json(failureResponse);
        sendWsBroadcastTo(account._id.toString(), { update_inventory: true });
        return;
    }

    const {
        MissionRewards,
        inventoryChanges,
        credits,
        AffiliationMods,
        SyndicateXPItemReward,
        ConquestCompletedMissionsCount,
        NemesisTaxInfo,
        RecoveredItemInfo
    } = await addMissionRewards(
        account,
        buildLabel,
        inventory,
        missionReport,
        firstCompletion,
        missionTimesOk && rewardSeedOk && clientInventoryUpdatesOk && xpGainOk && missionCompletesOk
    );
    await handleConservation(
        inventory,
        buildLabel,
        missionReport,
        AffiliationMods,
        getEffectiveAccountRate(getAccountRateProfile(account), "standingMultiplier")
    ); // Conservation reports have GS_SUCCESS

    if (inventory.pendingPremiumCredits) {
        await dispatchPendingPremiumCredits(inventory);
        //await inventory.save();
    }

    if (missionReport.EndOfMatchUpload || missionReport.RJ) {
        logger.debug(`refreshing reward seed`);
        inventory.RewardSeed = generateRewardSeed();
    }
    await inventory.save();
    if (settlementClaim) await completeMissionSettlementClaim(settlementClaim);

    if (version_compare(buildLabel, gameToBuildVersion["18.18.0"]) < 0) {
        // Client might crash if they see Endo, but their kids are gonna love it.
        filterInplace(MissionRewards, x => !x.StoreItem.startsWith("/Lotus/StoreItems/Upgrades/Mods/FusionBundles/"));
    }

    //TODO: figure out when to send inventory. it is needed for many cases.
    if (inventoryChanges) {
        combineInventoryChanges(inventoryUpdates.InventoryChanges, inventoryChanges);
    }
    const deltas: IMissionInventoryUpdateResponseRailjackInterstitial = {
        MissionRewards,
        ...credits,
        ...inventoryUpdates,
        //FusionPoints: inventoryChanges?.FusionPoints, // This in combination with InventoryJson or InventoryChanges seems to just double the number of endo shown, so unsure when this is needed.
        SyndicateXPItemReward,
        AffiliationMods,
        ConquestCompletedMissionsCount,
        NemesisTaxInfo,
        RecoveredItemInfo
    };
    if (
        missionReport.BMI ||
        missionReport.TNT ||
        missionReport.SSC ||
        missionReport.RJ ||
        missionReport.SS ||
        missionReport.CMI ||
        missionReport.EJC
    ) {
        logger.debug(`interstitial request, sending only deltas`, deltas);
        res.json(deltas);
    } else if (missionReport.RewardInfo) {
        logger.debug(`classic mission completion, sending everything`);
        const response: IMissionInventoryUpdateResponse = deltas;
        // InventoryJson is not recognised by early versions, and may lead them to buffer overrun if provided.
        if (version_compare(buildLabel, gameToBuildVersion["8.0.0"]) > 0) {
            response.InventoryJson = JSON.stringify(
                await getInventoryResponse(req, inventory, "xpBasedLevelCapDisabled" in req.query, buildLabel)
            );
        }
        if (missionReport.RewardInfo.sortieTag == "Final" && firstCompletion) {
            response.CompletedSortie = true;
        }
        res.json(response);
    } else {
        logger.debug(`no reward info, just syncing inventory`);
        // InventoryJson is not recognised by early versions, and may lead them to buffer overrun if provided.
        if (version_compare(buildLabel, gameToBuildVersion["8.0.0"]) > 0) {
            const inventoryResponse = await getInventoryResponse(
                req,
                inventory,
                "xpBasedLevelCapDisabled" in req.query,
                buildLabel
            );
            res.json({
                InventoryJson: JSON.stringify(inventoryResponse)
            } satisfies IMissionInventoryUpdateResponseBackToDryDock);
        } else {
            res.json({});
        }
    }

    sendWsBroadcastTo(account._id.toString(), { update_inventory: true });
};

/*
**** OUTPUT ****
- [x]  InventoryJson
- [x]  MissionRewards
- [x]  TotalCredits
- [x]  CreditsBonus
- [x]  MissionCredits
- [x]  InventoryChanges
- [x]  FusionPoints
*/
