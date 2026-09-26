import type {
    IMissionReward as IMissionRewardExternal,
    IRegion,
    IReward,
    TMissionType,
    TRarity
} from "warframe-public-export-plus";
import { ExportRewards } from "warframe-public-export-plus";
import type { IMissionReward } from "../types/missionTypes.ts";
import type { IMission } from "../types/inventoryTypes/inventoryTypes.ts";
import type { IRewardInfo } from "../types/requestTypes.ts";
import type { IRngResult } from "./rngService.ts";
import { SRng, generateRewardSeed, getRandomReward } from "./rngService.ts";
import { getRegion, getMissionDeck } from "./itemDataService.ts";
import { toStoreItem } from "./itemDataService.ts";
import { logger } from "../utils/logger.ts";
import { shouldDoServerQol } from "./configService.ts";
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";

export interface IConquestReward {
    at: number;
    pool: IRngResult[];
}

export const labConquestRewards: IConquestReward[] = [
    {
        at: 5,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/EntratiLabConquestRewards/EntratiLabConquestSilverRewards"
        ][0] as IRngResult[]
    },
    {
        at: 10,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/EntratiLabConquestRewards/EntratiLabConquestSilverRewards"
        ][0] as IRngResult[]
    },
    {
        at: 15,
        pool: [
            {
                type: "/Lotus/StoreItems/Types/Gameplay/EntratiLab/Resources/EntratiLanthornBundle",
                itemCount: 3,
                probability: 1
            }
        ]
    },
    {
        at: 20,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/EntratiLabConquestRewards/EntratiLabConquestGoldRewards"
        ][0] as IRngResult[]
    },
    {
        at: 28,
        pool: [{ type: "/Lotus/StoreItems/Types/Items/MiscItems/DistillPoints", itemCount: 20, probability: 1 }]
    },
    {
        at: 31,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/EntratiLabConquestRewards/EntratiLabConquestGoldRewards"
        ][0] as IRngResult[]
    },
    {
        at: 34,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/EntratiLabConquestRewards/EntratiLabConquestArcaneRewards"
        ][0] as IRngResult[]
    },
    { at: 37, pool: [{ type: "/Lotus/StoreItems/Types/Items/MiscItems/DistillPoints", itemCount: 50, probability: 1 }] }
];

export const hexConquestRewards: IConquestReward[] = [
    {
        at: 5,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/1999ConquestRewards/1999ConquestSilverRewards"
        ][0] as IRngResult[]
    },
    {
        at: 10,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/1999ConquestRewards/1999ConquestSilverRewards"
        ][0] as IRngResult[]
    },
    {
        at: 15,
        pool: [
            {
                type: "/Lotus/StoreItems/Types/BoosterPacks/1999StickersPackEchoesArchimedea",
                itemCount: 1,
                probability: 1
            }
        ]
    },
    {
        at: 20,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/1999ConquestRewards/1999ConquestGoldRewards"
        ][0] as IRngResult[]
    },
    {
        at: 28,
        pool: [{ type: "/Lotus/StoreItems/Types/Items/MiscItems/1999ConquestBucks", itemCount: 6, probability: 1 }]
    },
    {
        at: 31,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/1999ConquestRewards/1999ConquestGoldRewards"
        ][0] as IRngResult[]
    },
    {
        at: 34,
        pool: ExportRewards[
            "/Lotus/Types/Game/MissionDecks/1999ConquestRewards/1999ConquestArcaneRewards"
        ][0] as IRngResult[]
    },
    {
        at: 37,
        pool: [{ type: "/Lotus/StoreItems/Types/Items/MiscItems/1999ConquestBucks", itemCount: 9, probability: 1 }]
    }
];

export const droptableAliases: Record<string, string> = {
    "/Lotus/Types/DropTables/ManInTheWall/MITWGruzzlingArcanesDropTable":
        "/Lotus/Types/DropTables/EntratiLabDropTables/DoppelgangerDropTable",
    "/Lotus/Types/DropTables/WF1999DropTables/LasrianTankSteelPathDropTable":
        "/Lotus/Types/DropTables/WF1999DropTables/LasrianTankHardModeDropTable"
};

export const getRotations = async (
    rewardInfo: IRewardInfo,
    buildLabel: string,
    tierOverride?: number
): Promise<number[]> => {
    if (rewardInfo.VaultsCracked) {
        return Array.from({ length: rewardInfo.VaultsCracked }, (_, index) => Math.min(index, 2));
    }
    if (rewardInfo.T == 17 || rewardInfo.T == 19) return [0, 1];

    const region = await getRegion(rewardInfo.node, buildLabel);
    const missionType: TMissionType | undefined = region?.missionType;
    if (missionType == "MT_ARTIFACT") return rewardInfo.rewardTierOverrides ?? [];
    if (missionType == "MT_RESCUE" && rewardInfo.rewardTier !== undefined) return [rewardInfo.rewardTier];

    if (rewardInfo.CustomEOMTags) {
        const tags = rewardInfo.CustomEOMTags;
        if (tags[tags.length - 1].substring(0, 21) == "12MinWarNumObjectives") {
            const rotations = [2];
            for (let index = 1; index < tags.length; ++index) rotations.push(0);
            for (let index = 0; index < Number(tags[tags.length - 1].substring(21)); ++index) rotations.push(1);
            return rotations;
        }
    }

    if (
        rewardInfo.node == "SolNode105" &&
        shouldDoServerQol("tylRegorDropsTwoEquinoxParts", buildLabel, gameToBuildVersion["42.0.0"])
    ) {
        return [0, 1];
    }

    switch (region?.missionName) {
        case "/Lotus/Language/Missions/MissionName_Railjack":
        case "/Lotus/Language/Missions/MissionName_RailjackVolatile":
        case "/Lotus/Language/Missions/MissionName_RailjackExterminate":
        case "/Lotus/Language/Missions/MissionName_RailjackAssassinate":
        case "/Lotus/Language/Missions/MissionName_Assassination":
        case "/Lotus/Language/Missions/MissionName_Exterminate":
            return [0];
    }

    const rotationCount = rewardInfo.rewardQualifications?.length || 0;
    if (rotationCount == 0 && missionType != "MT_ENDLESS_EXTERMINATION" && missionType != "MT_RAILJACK") {
        return [0];
    }
    const rotationPattern = tierOverride === undefined ? [0, 0, 1, 2] : [tierOverride];
    return Array.from({ length: rotationCount }, (_, index) => rotationPattern[index % rotationPattern.length]);
};

export const getRandomRewardByChance = (pool: readonly IReward[], rng?: SRng): IRngResult | undefined => {
    if (rng) {
        const result = rng.randomReward(pool as readonly IRngResult[]);
        rng.randomFloat();
        return result;
    }
    return getRandomReward(pool as readonly IRngResult[]);
};

export const scaleAccountDropCount = (count: number, multiplier: number): number =>
    Math.max(0, Math.trunc(count * multiplier));

export const isEligibleForCreditReward = async (
    rewardInfo: IRewardInfo,
    missions: IMission,
    node: IRegion,
    buildLabel: string
): Promise<boolean> => {
    if ((await getRotations(rewardInfo, buildLabel)).length == 0) return missions.Tag == "SolNode720";
    return (
        node.missionType != "MT_JUNCTION" &&
        node.missionType != "MT_LANDSCAPE" &&
        ![
            "EventNode761",
            "EventNode762",
            "EventNode763",
            "SolNode761",
            "SolNode762",
            "SolNode763",
            "CrewBattleNode56",
            "CrewBattleNode556"
        ].includes(missions.Tag)
    );
};

export const getLevelCreditRewards = (node: Partial<IRegion>): number | undefined => {
    if (node.minEnemyLevel) return 1000 + (node.minEnemyLevel - 1) * 100;
    return undefined;
};

export const addFixedLevelRewards = async (
    rewards: IMissionRewardExternal,
    missionRewards: IMissionReward[],
    buildLabel: string,
    rewardInfo?: IRewardInfo
): Promise<number> => {
    let missionBonusCredits = 0;
    if (rewards.credits) missionBonusCredits += rewards.credits;
    for (const item of rewards.items ?? []) missionRewards.push({ StoreItem: item, ItemCount: 1 });
    for (const item of rewards.countedItems ?? []) {
        missionRewards.push({ StoreItem: toStoreItem(item.ItemType), ItemCount: item.ItemCount });
    }
    for (const item of rewards.countedStoreItems ?? []) missionRewards.push(item);

    if (!rewards.droptable) return missionBonusCredits;
    const droptable = getMissionDeck(rewards.droptable, buildLabel);
    if (!droptable) {
        logger.error(`unknown droptable ${rewards.droptable}`);
        return missionBonusCredits;
    }
    const rotations =
        rewardInfo && rewards.droptable != "/Lotus/Types/Game/MissionDecks/ProjectNightwatchBonusRewards"
            ? await getRotations(rewardInfo, buildLabel)
            : [0];
    if (rewards.droptable.startsWith("/Lotus/Types/Game/MissionDecks/VoidKeyMissionRewards/")) {
        const rarityProbability: Record<TRarity, number> = { COMMON: 0.2533, UNCOMMON: 0.11, RARE: 0.02, LEGENDARY: 0 };
        const pool = droptable[0].map(item => ({
            type: item.type,
            itemCount: item.itemCount,
            probability: rarityProbability[item.rarity!]
        }));
        const rng = new SRng(BigInt(rewardInfo?.rewardSeed ?? generateRewardSeed()) ^ 0xffffffffffffffffn);
        for (let index = 0; index < rotations.length; ++index) {
            const reward = getRandomRewardByChance(pool, rng);
            if (reward) missionRewards.push({ StoreItem: reward.type, ItemCount: reward.itemCount });
        }
    } else {
        logger.debug(`rolling ${rewards.droptable} for level key rewards`, { rotations });
        for (const tier of rotations) {
            const reward = getRandomRewardByChance(droptable[tier]);
            if (reward) missionRewards.push({ StoreItem: reward.type, ItemCount: reward.itemCount });
        }
    }
    return missionBonusCredits;
};
