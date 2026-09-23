import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";
import { getSessionByID } from "./sessionService.ts";
import { equipmentKeys } from "../types/inventoryTypes/inventoryTypes.ts";
import { SuspicionEvent } from "../models/suspicionEventModel.ts";
import type { TAccountDocument } from "./loginService.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { TSuspicionKind } from "../models/suspicionEventModel.ts";

export interface IAntiCheatContext {
    requestId: string;
    buildLabel: string;
    remoteAddress?: string;
}

/*
 * 结算上行报文的反作弊校验。
 *
 * 只有「会过网络」的作弊手法才可能在这里被抓住 —— 透视、无敌、无限弹药、传送这类纯本地
 * 改动不产生任何上行数据，服务端无从取证。本模块覆盖的是**写入结算包**的那一类：
 * 客户端在 deflate 之前原地改写 ezip 明文，就能伪造结算种子、任务时长、完成次数与经验增量。
 *
 * 所有阈值来自 config.antiCheat，默认只记日志（enforce=false）不改变任何行为。
 * 每次判定都会先写结构化日志；数据库事件按账号与判定类型做短窗口限流，管理面板据此列表与封禁。
 */

const isEnabled = (): boolean => config.antiCheat?.enabled ?? true;

/** enforce 关闭时所有检测只出日志，不影响结算结果。 */
export const isAntiCheatEnforcing = (): boolean => isEnabled() && (config.antiCheat?.enforce ?? false);

// 同一账号同一判定在短时间内重复触发时只落一条记录，避免恶意高频上报把集合写爆。
// 正常结算间隔远大于此值，不会丢有效证据。
const EVENT_THROTTLE_MS = 2000;
const lastEventAt = new Map<string, number>();

const countedInventoryFields = [
    "MiscItems",
    "Recipes",
    "FusionBundles",
    "Consumables",
    "FusionBundels",
    "CrewShipRawSalvage",
    "CrewShipAmmo",
    "BonusMiscItems",
    "EmailItems",
    "ShipDecorations",
    "LevelKeys",
    "RawUpgrades",
    "FusionTreasures"
] as const;

/** 所有可疑判定统一从这里出日志并落库，便于运维 grep 与面板取证。 */
const flagSuspicious = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    kind: TSuspicionKind,
    details: Record<string, unknown>,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext
): void => {
    logger.warn(`[anti-cheat] ${kind}`, {
        requestId: context.requestId,
        account: account._id.toString(),
        displayName: account.DisplayName,
        buildLabel: context.buildLabel,
        ...details
    });

    const key = `${account._id.toString()}:${kind}`;
    const now = Date.now();
    const previous = lastEventAt.get(key);
    if (previous !== undefined && now - previous < EVENT_THROTTLE_MS) return;
    if (lastEventAt.size > 4096) lastEventAt.clear();
    lastEventAt.set(key, now);

    // 落库失败绝不能影响结算：反作弊是旁路，不是主链路。
    void SuspicionEvent.create({
        AccountId: account._id,
        DisplayName: account.DisplayName,
        Kind: kind,
        Details: details,
        RequestId: context.requestId,
        BuildLabel: context.buildLabel,
        MissionStatus: missionReport.MissionStatus,
        MissionTime: missionReport.MissionTime,
        AliveTime: missionReport.AliveTime,
        RemoteAddress: context.remoteAddress,
        Enforced: isAntiCheatEnforcing(),
        MissionTag: missionReport.Missions?.Tag ?? missionReport.RewardInfo?.node,
        SessionId: missionReport.sharedSessionId || undefined
    }).catch((error: Error) => logger.warn(`[anti-cheat] failed to record suspicion event`, { error: error.message }));
};

/** 会话种子可能是 number（mongoose 读出）也可能是 bigint，统一成 bigint 再比。 */
const toBigInt = (value: number | bigint): bigint | null => {
    if (typeof value == "bigint") return value;
    return Number.isInteger(value) ? BigInt(value) : null;
};

/**
 * 校验客户端上报的 rewardSeed 是否是服务端发给它的种子之一。
 *
 * 该种子是结算奖励 RNG 的唯一输入（服务端用 SRng(seed ^ 0xffffffffffffffff) 洗任务奖励），
 * 而且客户端上报什么就用什么 —— 所以只要在 ezip 明文里把它改掉，就能定点开出任意奖励。
 *
 * 客户端**合法持有两个种子**，任选其一上报都是正常的：
 *   1. 会话种子 —— hostSession / joinSession 下发，会话存续期间不变；
 *   2. 库存种子 —— 每次 EndOfMatchUpload 都会被刷新，getNewRewardSeed 也会刷新，
 *      并且随结算响应的 InventoryJson 回传给客户端。
 * 两者会在**同一会话的第二局**开始合法地分叉（会话种子不变、库存种子已刷新），
 * 所以只比对会话种子会稳定误报。必须两个都接受。
 *
 * enforce 开启时**不拒绝结算**，而是把上报值改回服务端发出的种子：奖励回到正常 roll，
 * 既不会连带吞掉正常掉落，也不存在误判导致玩家颗粒无收的风险。
 *
 * @returns 命中任一合法种子（或无法判定）时返回 true。
 */
export const verifyRewardSeed = async (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest,
    inventory: Pick<TInventoryDatabaseDocument, "RewardSeed">,
    context: IAntiCheatContext
): Promise<boolean> => {
    if (!isEnabled()) return true;

    const rewardInfo = missionReport.RewardInfo;
    if (rewardInfo == undefined) return true;
    const reportedSeed = rewardInfo.rewardSeed;
    if (reportedSeed == undefined) return true;
    const actual = toBigInt(reportedSeed);
    if (actual == null) return true;

    // sharedSessionId 是裸 ObjectId 十六进制串（实机报文核实）。会话有 5 分钟 TTL，过期即查不到。
    const sessionId = missionReport.sharedSessionId;
    let sessionSeed: bigint | null = null;
    if (sessionId) {
        const session = await getSessionByID(sessionId);
        if (session != null) {
            sessionSeed = toBigInt(session.rewardSeed);
        }
    }
    const inventorySeed = toBigInt(inventory.RewardSeed);

    const expected = [sessionSeed, inventorySeed].filter((seed): seed is bigint => seed != null);
    if (expected.length == 0 || expected.some(seed => seed == actual)) return true;

    flagSuspicious(
        account,
        "rewardSeedMismatch",
        {
            reported: actual.toString(),
            sessionSeed: sessionSeed?.toString() ?? "unknown",
            inventorySeed: inventorySeed?.toString() ?? "unknown",
            sessionId
        },
        missionReport,
        context
    );
    // expected is non-empty here: the early return above covers the "no seed to compare against" case.
    const replacement = expected[0];
    if (isAntiCheatEnforcing()) {
        rewardInfo.rewardSeed = replacement;
    }
    return false;
};

/**
 * 校验任务时长。自动扫星类脚本靠「进图数秒即结算」完成，MissionTime 会落在个位数秒；
 * 正常任务即使速通也远高于此。AliveTime > MissionTime 在物理上不可能，一并判定。
 *
 * 只判定不修改：是否据此拒绝发放奖励由调用方结合 enforce 决定。
 */
export const verifyMissionTimes = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext
): boolean => {
    if (!isEnabled()) return true;

    // 失败/中止的局本来就不发奖励，时长没有意义。
    const aborted = missionReport.MissionStatus
        ? missionReport.MissionStatus != "GS_SUCCESS"
        : missionReport.MissionFailed;
    if (aborted) return true;

    let ok = true;
    const minTimeSec = config.antiCheat?.minMissionTimeSec ?? 20;
    if (minTimeSec > 0 && missionReport.MissionTime < minTimeSec) {
        flagSuspicious(
            account,
            "impossibleMissionTime",
            {
                missionTime: missionReport.MissionTime,
                minMissionTimeSec: minTimeSec
            },
            missionReport,
            context
        );
        ok = false;
    }
    if (missionReport.AliveTime > missionReport.MissionTime) {
        flagSuspicious(
            account,
            "impossibleMissionTime",
            {
                aliveTime: missionReport.AliveTime,
                missionTime: missionReport.MissionTime,
                reason: "aliveTimeExceedsMissionTime"
            },
            missionReport,
            context
        );
        ok = false;
    }
    return ok;
};

/**
 * 校验客户端直接提交的库存增量。
 *
 * 这些字段在正常任务中可以出现，但它们不能接受负数、浮点数、空类型或明显超大的单次数量。
 * 这不是掉落表重放的替代品；它先挡住最常见的“改一个 ItemCount 就刷满库存”的报文。
 */
export const verifyClientInventoryUpdates = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext
): boolean => {
    if (!isEnabled()) return true;

    const maxItemCount = config.antiCheat?.maxClientItemCountPerReport ?? 10000;
    const fail = (
        kind: "invalidInventoryUpdate" | "excessiveInventoryUpdate",
        details: Record<string, unknown>
    ): boolean => {
        flagSuspicious(account, kind, details, missionReport, context);
        return false;
    };

    for (const field of countedInventoryFields) {
        const items = missionReport[field] as unknown;
        if (!Array.isArray(items)) continue;
        for (const [index, item] of items.entries()) {
            if (
                typeof item != "object" ||
                item == null ||
                typeof (item as { ItemType?: unknown }).ItemType != "string"
            ) {
                return fail("invalidInventoryUpdate", { field, index, reason: "missingItemType" });
            }
            const itemType = (item as { ItemType: string }).ItemType;
            if (!itemType.startsWith("/Lotus/")) {
                return fail("invalidInventoryUpdate", { field, index, itemType, reason: "invalidItemType" });
            }
            const itemCount = (item as { ItemCount?: unknown }).ItemCount;
            if (itemCount !== undefined) {
                if (typeof itemCount != "number" || !Number.isSafeInteger(itemCount) || itemCount <= 0) {
                    return fail("invalidInventoryUpdate", {
                        field,
                        index,
                        itemType,
                        itemCount,
                        reason: "invalidItemCount"
                    });
                }
                if (maxItemCount > 0 && itemCount > maxItemCount) {
                    return fail("excessiveInventoryUpdate", {
                        field,
                        index,
                        itemType,
                        requested: itemCount,
                        allowed: maxItemCount
                    });
                }
            }
        }
    }

    if (missionReport.RegularCredits !== undefined) {
        const credits = missionReport.RegularCredits;
        if (!Number.isSafeInteger(credits) || credits < 0) {
            return fail("invalidInventoryUpdate", {
                field: "RegularCredits",
                value: credits,
                reason: "invalidCreditDelta"
            });
        }
        if (maxItemCount > 0 && credits > maxItemCount * 1000) {
            return fail("excessiveInventoryUpdate", {
                field: "RegularCredits",
                requested: credits,
                allowed: maxItemCount * 1000
            });
        }
    }

    return true;
};

/**
 * 限制单次结算能计入的任务完成次数。正常结算 Completes 恒为 1（实机报文核实），
 * 而原本的实现是 `Completes += 客户端值`，没有上界。
 *
 * 这里直接夹紧而不是只记日志：合法报文的 Completes 远低于任何合理上限，夹紧没有误判风险。
 */
export const clampMissionCompletes = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext
): void => {
    if (!isEnabled()) return;

    const mission = missionReport.Missions;
    if (mission == undefined) return;

    const maxCompletes = config.antiCheat?.maxMissionCompletesPerReport ?? 10;
    if (maxCompletes <= 0 || mission.Completes <= maxCompletes) return;

    flagSuspicious(
        account,
        "excessiveMissionCompletes",
        {
            requested: mission.Completes,
            allowed: maxCompletes
        },
        missionReport,
        context
    );
    mission.Completes = maxCompletes;
};

/**
 * 校验装备经验增量速率。XP Multiplier 类脚本把本局累积放大数倍后随结算上报，
 * 单看上报值看不出来，但「单位任务时长内的经验量」会明显偏离正常区间。
 *
 * 只判定不修改：按比例削减经验需要逐件重算并同步 XPInfo，风险高于收益；enforce 开启时由调用方拒绝整份结算。
 */
export const verifyXpGain = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext
): boolean => {
    if (!isEnabled()) return true;

    const maxPerSecond = config.antiCheat?.maxXpPerMissionSecond ?? 100000;
    if (maxPerSecond <= 0) return true;

    let totalXp = 0;
    for (const key of equipmentKeys) {
        const gear = missionReport[key];
        if (!Array.isArray(gear)) continue;
        for (const item of gear) {
            totalXp += item.XP ?? 0;
        }
    }
    if (totalXp <= 0) return true;

    const seconds = Math.max(missionReport.MissionTime, 1);
    if (totalXp / seconds <= maxPerSecond) return true;

    flagSuspicious(
        account,
        "excessiveXpGain",
        {
            totalXp,
            missionTime: seconds,
            xpPerSecond: Math.round(totalXp / seconds),
            maxXpPerMissionSecond: maxPerSecond
        },
        missionReport,
        context
    );
    return false;
};
