import type { RequestHandler } from "express";
import {
    getWorldState,
    populateDailyDeal,
    populateFeaturedGuilds,
    populateFissures,
    populateAlerts
} from "../../services/worldStateService.ts";
import { getAccountForQuery, getAccountForRequest, getBuildLabel } from "../../services/loginService.ts";
import { BL_LATEST } from "../../constants/gameVersions.ts";
import { getInventory2 } from "../../services/inventoryService.ts";
import { applyLiveWorldState, refreshLiveWorldState } from "../../services/liveWorldStateService.ts";
import { applyStoreOverrides } from "../../services/storeOverrideService.ts";
import { getAccountRateProfile, getEffectiveAccountRate } from "../../services/accountRateService.ts";
import { applyAccountPickupBoost, applyAccountWorldStateBoost } from "../../services/accountPickupBoostService.ts";
import { logger } from "../../utils/logger.ts";
import { fromMongoDate } from "../../helpers/inventoryHelpers.ts";
import gameToBuildVersionInt from "../../constants/gameToBuildVersionInt.ts";
import { buildVersionToInt } from "../../helpers/versionHelper.ts";

const normalizeWorldStateForClient = (worldState: ReturnType<typeof getWorldState>, buildLabel: string): void => {
    const buildVersion = buildVersionToInt(buildLabel);

    if (buildVersion >= gameToBuildVersionInt["22.10.1"]) {
        for (const sale of worldState.FlashSales) {
            delete sale.Featured;
            delete sale.Popular;
            delete sale.BannerIndex;
        }
    }

    if (buildVersion >= gameToBuildVersionInt["44.0.0"]) {
        const response = worldState as unknown as Record<string, unknown>;
        delete response.PrimeVaultAvailabilities;
        delete response.PrimeTokenAvailability;

        for (const goal of worldState.Goals) {
            const missionReward = goal.MissionInfo?.missionReward as { randomizedItems?: string } | undefined;
            if (missionReward?.randomizedItems == "razorbackRewardManifest") {
                delete goal.MissionInfo!.missionReward;
            }
        }

        for (const challenge of worldState.SeasonInfo?.ActiveChallenges ?? []) {
            delete (challenge as typeof challenge & { HasPrerequisites?: boolean }).HasPrerequisites;
        }
    }
};

export const worldStateController: RequestHandler = async (req, res) => {
    let buildLabel: string;
    let language: string | undefined;
    let elionWorkaroundNeeded = false;
    let accountPickupMultiplier = 1;
    let accountCreditMultiplier = 1;
    let accountAffinityMultiplier = 1;
    let accountRateExpiry: string | undefined;
    if (req.params.accountId || req.query.accountId) {
        const account = req.params.accountId
            ? await getAccountForQuery(
                  { accountId: req.params.accountId, token: req.params.accountToken, ct: "WORLDSTATE" },
                  "WORLDSTATE"
              )
            : await getAccountForRequest(req);
        const profile = getAccountRateProfile(account);
        accountPickupMultiplier = getEffectiveAccountRate(profile, "resourceDropMultiplier");
        accountCreditMultiplier = getEffectiveAccountRate(profile, "creditMultiplier");
        accountAffinityMultiplier = getEffectiveAccountRate(profile, "affinityMultiplier");
        accountRateExpiry = profile.expiresAt;
        buildLabel = getBuildLabel(req, account);
        language = account.Language;
        if (buildLabel == "2013.07.04.20.17/") {
            const inventory = await getInventory2(account._id, "Missions");
            if (
                !inventory.Missions.some(x => x.Tag == "SolNode12" && x.Completes > 0) && // Not done Elion yet?
                (inventory.Missions.find(x => x.Tag == "SolNode119")?.Completes ?? 0) > 0 // but have done Caloris (mission before Elion)?
            ) {
                elionWorkaroundNeeded = true; // User is gonna need help in this buildLabel
            }
        }
    } else if (typeof req.query.buildLabel == "string") {
        buildLabel = req.query.buildLabel.replaceAll(" ", "+");
    } else {
        buildLabel = BL_LATEST;
    }

    const worldState = getWorldState(buildLabel);
    await Promise.all([
        populateDailyDeal(worldState),
        populateFeaturedGuilds(worldState),
        populateFissures(worldState),
        populateAlerts(worldState),
        refreshLiveWorldState()
    ]);
    applyLiveWorldState(worldState);
    applyStoreOverrides(worldState, buildLabel);
    language = typeof req.query.l == "string" ? req.query.l : language;
    normalizeWorldStateForClient(worldState, buildLabel);
    if (req.params.accountId) {
        applyAccountPickupBoost(worldState, buildLabel, accountPickupMultiplier, accountRateExpiry);
        applyAccountWorldStateBoost(worldState, buildLabel, "credit", accountCreditMultiplier, accountRateExpiry);
        applyAccountWorldStateBoost(worldState, buildLabel, "affinity", accountAffinityMultiplier, accountRateExpiry);
        if (accountPickupMultiplier != 1 || accountCreditMultiplier != 1 || accountAffinityMultiplier != 1) {
            logger.debug("sending account world state boosts", {
                accountId: req.params.accountId,
                resourceDropMultiplier: accountPickupMultiplier,
                creditMultiplier: accountCreditMultiplier,
                affinityMultiplier: accountAffinityMultiplier,
                profileExpiresAt: accountRateExpiry ?? null,
                upgrades: worldState.GlobalUpgrades.filter(upgrade =>
                    ["GAMEPLAY_PICKUP_AMOUNT", "GAMEPLAY_MONEY_REWARD_AMOUNT", "GAMEPLAY_KILL_XP_AMOUNT"].includes(
                        upgrade.UpgradeType
                    )
                ).map(upgrade => ({
                    type: upgrade.UpgradeType,
                    value: upgrade.Value,
                    expiresAt: fromMongoDate(upgrade.ExpiryDate).toISOString()
                }))
            });
        }
    }

    if (elionWorkaroundNeeded) {
        worldState.Alerts.push({
            _id: { $id: "e1i03119f130000000000000" },
            Activation: { sec: 0, usec: 0 },
            Expiry: { sec: 2000000000, usec: 0 },
            MissionInfo: {
                location: "SolNode12",
                completeTag: "SolNode12",
                missionType: "MT_RESCUE",
                faction: "FC_GRINEER",
                difficulty: 0.1,
                levelOverride: "/Lotus/Levels/Proc/Corpus/CorpusLevel", // The issue seems to be with "/Lotus/Levels/Proc/Grineer/SimpleGrineerGalleonLevel" + MT_RESCUE, which Elion is, so this fixes it.
                enemySpec: "/Lotus/Types/Game/GrineerSquadOne",
                minEnemyLevel: 1,
                maxEnemyLevel: 3,
                descText: "Elion is bugged in this version. Use this alert to complete it instead!"
            }
        });
    }

    const messageLanguage = language ?? "en";
    for (const event of worldState.Events) {
        const msg =
            event.Messages.find(x => x.LanguageCode == messageLanguage)?.Message ??
            event.Messages.find(x => x.LanguageCode == "en")?.Message ??
            event.Msg ??
            event.Messages[0]?.Message;
        if (msg) {
            event.Messages = [{ Message: msg }];
        }
    }

    res.json(worldState);
};
