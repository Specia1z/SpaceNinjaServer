import type { IMissionReward } from "warframe-public-export-plus";
import { ExportRegions } from "warframe-public-export-plus";
import invasionNodes from "../../static/fixed_responses/worldState/invasionNodes.json" with { type: "json" };
import invasionRewards from "../../static/fixed_responses/worldState/invasionRewards.json" with { type: "json" };
import { EPOCH, unixTimesInMs } from "../constants/timeConstants.ts";
import type { IInvasion } from "../types/worldStateTypes.ts";
import { toMongoDate2, toOid2 } from "../helpers/inventoryHelpers.ts";
import { sequentiallyUniqueRandomElement, SRng } from "./rngService.ts";

const INVASION_MARKER = "fd148cb8";
const RETENTION_MS = 30 * unixTimesInMs.day;

const getRotationDurationMs = (rotationHours: number | undefined): number =>
    Math.max(1, Math.min(168, Math.trunc(rotationHours ?? 24))) * unixTimesInMs.hour;

const getRotationIndex = (timeMs: number, rotationHours: number | undefined): number =>
    Math.floor((timeMs - EPOCH) / getRotationDurationMs(rotationHours));

const getRoundStartMs = (rotationIndex: number, rotationHours: number | undefined): number =>
    EPOCH + rotationIndex * getRotationDurationMs(rotationHours);

/**
 * Generate an invasion from a stable rotation timestamp. The same inputs always
 * produce the same node, factions, and battle pay, which lets a small server
 * rotate activities without a separate reward-generation job.
 */
export const createInvasionAt = (
    startMs: number,
    rotationIndex: number,
    idx: number,
    buildVersion: number,
    completed = false,
    simulateProgress = false,
    nowMs = Date.now()
): IInvasion => {
    const seed = rotationIndex * 3 + idx;
    const rng = new SRng(new SRng(seed).randomInt(0, 1_000_000));
    const defender = (["FC_GRINEER", "FC_CORPUS", rotationIndex % 2 ? "FC_GRINEER" : "FC_CORPUS"] as const)[idx];
    const isInfestationOutbreak = rng.randomInt(0, 1) == 0;
    const attacker = isInfestationOutbreak ? "FC_INFESTATION" : defender == "FC_GRINEER" ? "FC_CORPUS" : "FC_GRINEER";
    const oid =
        ((startMs / 1000) & 0xffffffff).toString(16).padStart(8, "0") +
        INVASION_MARKER +
        (idx & 0xffffffff).toString(16).padStart(8, "0");
    const node = sequentiallyUniqueRandomElement(invasionNodes[defender], seed, 5, 690175)!;
    const countMultiplier = isInfestationOutbreak || rng.randomInt(0, 1) ? -1 : 1;
    const progress = (nowMs - startMs) / getRotationDurationMs(24);
    const fiftyPercent = rng.randomInt(1000, 29000);
    const rewardFloat = rng.randomFloat();
    const rewardTier = rewardFloat < 0.201 ? "RARE" : rewardFloat < 0.7788 ? "COMMON" : "UNCOMMON";
    const attackerReward: IMissionReward = {};
    const defenderReward: IMissionReward = {};
    if (isInfestationOutbreak) {
        defenderReward.countedItems = [
            rng.randomElement(invasionRewards[rng.randomInt(0, 1) ? "FC_INFESTATION" : defender][rewardTier])!
        ];
    } else {
        attackerReward.countedItems = [rng.randomElement(invasionRewards[attacker][rewardTier])!];
        defenderReward.countedItems = [rng.randomElement(invasionRewards[defender][rewardTier])!];
    }

    return {
        _id: toOid2(oid, buildVersion),
        Faction: attacker,
        DefenderFaction: defender,
        Node: node,
        Count: simulateProgress
            ? Math.round(
                  (progress < 0.5
                      ? progress * 2 * fiftyPercent
                      : fiftyPercent + (30_000 - fiftyPercent) * (progress - 0.5)) * countMultiplier
              )
            : completed
              ? 30_000 * countMultiplier
              : 0,
        Goal: 30000,
        LocTag: isInfestationOutbreak
            ? ExportRegions[node].missionType == "MT_ASSASSINATION"
                ? "/Lotus/Language/Menu/InfestedInvasionBoss"
                : "/Lotus/Language/Menu/InfestedInvasionGeneric"
            : attacker == "FC_CORPUS"
              ? "/Lotus/Language/Menu/CorpusInvasionGeneric"
              : "/Lotus/Language/Menu/GrineerInvasionGeneric",
        Completed: completed,
        ChainID: { $oid: oid },
        AttackerReward: attackerReward,
        AttackerMissionInfo: {
            seed: rng.randomInt(0, 1_000_000),
            faction: defender
        },
        DefenderReward: defenderReward,
        DefenderMissionInfo: {
            seed: rng.randomInt(0, 1_000_000),
            faction: attacker
        },
        Activation: toMongoDate2(startMs, buildVersion)
    };
};

export const getLocalInvasions = (buildVersion: number, nowMs = Date.now(), rotationHours = 24): IInvasion[] => {
    const rotationIndex = getRotationIndex(nowMs, rotationHours);
    return [0, 1, 2].flatMap(idx =>
        [rotationIndex, rotationIndex - 1].map(index =>
            createInvasionAt(
                getRoundStartMs(index, rotationHours),
                index,
                idx,
                buildVersion,
                index < rotationIndex,
                false,
                nowMs
            )
        )
    );
};

export const getLocalInvasionByOid = (
    oid: string,
    buildVersion: number,
    rotationHours = 24,
    nowMs = Date.now()
): IInvasion | undefined => {
    const parts = oid.split(INVASION_MARKER);
    if (parts.length != 2 || parts[0].length != 8 || parts[1].length != 8) return undefined;

    const startMs = parseInt(parts[0], 16) * 1000;
    const idx = parseInt(parts[1], 16);
    if (!Number.isFinite(startMs) || !Number.isFinite(idx) || idx < 0 || idx > 2) return undefined;

    const rotationIndex = getRotationIndex(startMs, rotationHours);
    const expectedStartMs = getRoundStartMs(rotationIndex, rotationHours);
    if (expectedStartMs != startMs || nowMs - startMs > RETENTION_MS || startMs > nowMs) {
        return undefined;
    }

    const invasion = createInvasionAt(
        startMs,
        rotationIndex,
        idx,
        buildVersion,
        startMs + getRotationDurationMs(rotationHours) <= nowMs,
        false,
        nowMs
    );
    return invasion._id.$oid == oid ? invasion : undefined;
};

export const getInvasionRotationStatus = (
    nowMs = Date.now(),
    rotationHours = 24
): { rotationIndex: number; startedAt: Date; settlesAt: Date; nextRotationAt: Date } => {
    const rotationIndex = getRotationIndex(nowMs, rotationHours);
    const startedAt = getRoundStartMs(rotationIndex, rotationHours);
    const settlesAt = startedAt + getRotationDurationMs(rotationHours);
    return {
        rotationIndex,
        startedAt: new Date(startedAt),
        settlesAt: new Date(settlesAt),
        nextRotationAt: new Date(settlesAt)
    };
};
