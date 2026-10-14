import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";
import { getSessionByID } from "./sessionService.ts";
import { equipmentKeys } from "../types/inventoryTypes/inventoryTypes.ts";
import { SuspicionEvent } from "../models/suspicionEventModel.ts";
import type { TAccountDocument } from "./loginService.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";
import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { TSuspicionKind, TSuspicionResponse } from "../models/suspicionEventModel.ts";
import type { TAntiCheatResponseMode } from "./configService.ts";

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
 * responseMode 默认 observe；sanitize 只修复/限幅有明确边界的客户端字段；reject 丢弃整份可疑结算。
 * 每次判定都会先写结构化日志；数据库事件按账号与判定类型做短窗口限流，管理面板据此列表与封禁。
 */

const isEnabled = (): boolean => config.antiCheat?.enabled ?? true;

/** Keep the legacy enforce toggle meaningful for installations whose config predates responseMode. */
export const getAntiCheatResponseMode = (): TAntiCheatResponseMode =>
    config.antiCheat?.responseMode ?? (config.antiCheat?.enforce ? "reject" : "observe");

export const isAntiCheatEnforcing = (): boolean => isEnabled() && getAntiCheatResponseMode() === "reject";
export const isAntiCheatSanitizing = (): boolean => isEnabled() && getAntiCheatResponseMode() === "sanitize";

const riskScores: Record<TSuspicionKind, number> = {
    rewardSeedMismatch: 60,
    impossibleMissionTime: 35,
    excessiveMissionCompletes: 45,
    excessiveXpGain: 45,
    invalidInventoryUpdate: 60,
    excessiveInventoryUpdate: 35
};

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

const removeClientControlledClaims = (missionReport: IMissionInventoryUpdateRequest): void => {
    for (const field of countedInventoryFields) {
        delete (missionReport as unknown as Record<string, unknown>)[field];
    }
    delete missionReport.RegularCredits;
    delete missionReport.Missions;
    delete missionReport.RewardInfo;
    delete missionReport.CompletedAlerts;
    delete missionReport.AffiliationChanges;
    delete missionReport.EvolutionProgress;
    delete missionReport.FocusXpIncreases;
    delete (missionReport as unknown as Record<string, unknown>).PlayerSkillGains;
};

const getViolationResponse = (sanitizable: boolean): TSuspicionResponse | undefined => {
    const mode = getAntiCheatResponseMode();
    if (mode == "reject") return "rejected";
    if (mode == "sanitize" && sanitizable) return "sanitized";
    return undefined;
};

/** 所有可疑判定统一从这里出日志并落库，便于运维 grep 与面板取证。 */
const flagSuspicious = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    kind: TSuspicionKind,
    details: Record<string, unknown>,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext,
    response?: TSuspicionResponse
): void => {
    const mode = getAntiCheatResponseMode();
    const effectiveResponse =
        response ?? (mode === "reject" ? "rejected" : mode === "sanitize" ? "sanitized" : "observed");
    logger.warn(`[anti-cheat] ${kind}`, {
        requestId: context.requestId,
        account: account._id.toString(),
        displayName: account.DisplayName,
        buildLabel: context.buildLabel,
        riskScore: riskScores[kind],
        response: effectiveResponse,
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
        RiskScore: riskScores[kind],
        Response: effectiveResponse,
        RequestId: context.requestId,
        BuildLabel: context.buildLabel,
        MissionStatus: missionReport.MissionStatus,
        MissionTime: missionReport.MissionTime,
        AliveTime: missionReport.AliveTime,
        RemoteAddress: context.remoteAddress,
        Enforced: effectiveResponse == "rejected",
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
 * sanitize 模式下**不拒绝结算**，而是把上报值改回服务端发出的种子：奖励回到正常 roll，
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
        context,
        getViolationResponse(true) == "sanitized" ? "corrected" : undefined
    );
    // expected is non-empty here: the early return above covers the "no seed to compare against" case.
    const replacement = expected[0];
    if (isAntiCheatSanitizing()) {
        rewardInfo.rewardSeed = replacement;
    }
    return false;
};

/**
 * 校验任务时长。自动扫星类脚本靠「进图数秒即结算」完成，MissionTime 会落在个位数秒；
 * 正常任务即使速通也远高于此。AliveTime > MissionTime 在物理上不可能，一并判定。
 *
 * observe 只判定不修改；sanitize 会移除客户端结算声明并把任务标记为失败；reject 由调用方丢弃整份报文。
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
            context,
            getViolationResponse(true)
        );
        if (isAntiCheatSanitizing()) {
            removeClientControlledClaims(missionReport);
            missionReport.MissionFailed = true;
            missionReport.MissionStatus = "GS_FAILURE";
        }
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
            context,
            getViolationResponse(true)
        );
        if (isAntiCheatSanitizing()) {
            removeClientControlledClaims(missionReport);
            missionReport.MissionFailed = true;
            missionReport.MissionStatus = "GS_FAILURE";
        }
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
    const maxEntries = config.antiCheat?.maxClientInventoryEntriesPerReport ?? 250;
    const maxCredits = config.antiCheat?.maxClientCreditsPerReport ?? (maxItemCount > 0 ? maxItemCount * 1000 : 0);
    const mode = getAntiCheatResponseMode();
    const invalidDetails: Record<string, unknown>[] = [];
    const excessiveDetails: Record<string, unknown>[] = [];
    let retainedEntries = 0;

    const noteInvalid = (details: Record<string, unknown>): void => {
        invalidDetails.push(details);
    };
    const noteExcessive = (details: Record<string, unknown>): void => {
        excessiveDetails.push(details);
    };

    for (const field of countedInventoryFields) {
        const report = missionReport as unknown as Record<string, unknown>;
        const items = report[field];
        if (items === undefined) continue;
        if (!Array.isArray(items)) {
            noteInvalid({ field, reason: "expectedArray" });
            if (mode == "sanitize") delete report[field];
            continue;
        }

        const output: unknown[] = [];
        const totals = new Map<string, number>();
        for (const [index, rawItem] of items.entries()) {
            if (
                typeof rawItem != "object" ||
                rawItem == null ||
                typeof (rawItem as { ItemType?: unknown }).ItemType != "string"
            ) {
                noteInvalid({ field, index, reason: "missingItemType" });
                if (mode != "sanitize") output.push(rawItem);
                continue;
            }
            const item = rawItem as { ItemType: string; ItemCount?: unknown } & Record<string, unknown>;
            const itemType = item.ItemType;
            if (!itemType.startsWith("/Lotus/")) {
                noteInvalid({ field, index, itemType, reason: "invalidItemType" });
                if (mode != "sanitize") output.push(rawItem);
                continue;
            }

            const itemCount = item.ItemCount;
            if (itemCount === undefined && field != "FusionTreasures") {
                noteInvalid({ field, index, itemType, itemCount, reason: "invalidItemCount" });
                if (mode != "sanitize") output.push(rawItem);
                continue;
            }
            if (
                itemCount !== undefined &&
                (typeof itemCount != "number" || !Number.isSafeInteger(itemCount) || itemCount <= 0)
            ) {
                noteInvalid({ field, index, itemType, itemCount, reason: "invalidItemCount" });
                if (mode != "sanitize") output.push(rawItem);
                continue;
            }

            if (maxEntries > 0 && retainedEntries >= maxEntries) {
                noteExcessive({ field, index, reason: "tooManyEntries", allowed: maxEntries });
                if (mode != "sanitize") output.push(rawItem);
                continue;
            }
            retainedEntries++;

            if (itemCount === undefined) {
                output.push(rawItem);
                continue;
            }

            const count = itemCount;
            const prior = totals.get(itemType) ?? 0;
            const remaining = maxItemCount > 0 ? Math.max(0, maxItemCount - prior) : count;
            if (maxItemCount > 0 && count > remaining) {
                noteExcessive({ field, index, itemType, requested: count + prior, allowed: maxItemCount });
            }
            if (mode == "sanitize" && remaining <= 0) continue;
            const accepted = mode == "sanitize" ? Math.min(count, remaining) : count;
            totals.set(itemType, prior + accepted);
            if (mode == "sanitize") {
                const existing = output.find(
                    entry =>
                        typeof entry == "object" &&
                        entry != null &&
                        (entry as { ItemType?: unknown }).ItemType == itemType
                ) as { ItemCount?: number } | undefined;
                if (existing) existing.ItemCount = (existing.ItemCount ?? 0) + accepted;
                else output.push({ ...item, ItemCount: accepted });
            } else {
                output.push(rawItem);
            }
        }
        if (mode == "sanitize") report[field] = output;
    }

    if (missionReport.RegularCredits !== undefined) {
        const credits = missionReport.RegularCredits;
        if (!Number.isSafeInteger(credits) || credits < 0) {
            noteInvalid({ field: "RegularCredits", value: credits, reason: "invalidCreditDelta" });
            if (mode == "sanitize") delete missionReport.RegularCredits;
        } else if (maxCredits > 0 && credits > maxCredits) {
            noteExcessive({ field: "RegularCredits", requested: credits, allowed: maxCredits });
            if (mode == "sanitize") missionReport.RegularCredits = maxCredits;
        }
    }

    if (invalidDetails.length > 0) {
        flagSuspicious(
            account,
            "invalidInventoryUpdate",
            invalidDetails[0],
            missionReport,
            context,
            getViolationResponse(true)
        );
    }
    if (excessiveDetails.length > 0) {
        flagSuspicious(
            account,
            "excessiveInventoryUpdate",
            excessiveDetails[0],
            missionReport,
            context,
            getViolationResponse(true)
        );
    }
    return invalidDetails.length == 0 && excessiveDetails.length == 0;
};

/**
 * 限制单次结算能计入的任务完成次数。正常结算 Completes 恒为 1（实机报文核实），
 * 而原本的实现是 `Completes += 客户端值`，没有上界。
 *
 * 仅 sanitize 模式会夹紧；observe 保留原始数据，reject 由结算控制器丢弃整份报文。
 */
export const clampMissionCompletes = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest,
    context: IAntiCheatContext
): boolean => {
    if (!isEnabled()) return true;

    const mission = missionReport.Missions;
    if (mission == undefined) return true;

    const maxCompletes = config.antiCheat?.maxMissionCompletesPerReport ?? 10;
    const invalidCompletes = !Number.isSafeInteger(mission.Completes) || mission.Completes < 0;
    if (!invalidCompletes && (maxCompletes <= 0 || mission.Completes <= maxCompletes)) return true;

    flagSuspicious(
        account,
        "excessiveMissionCompletes",
        invalidCompletes
            ? { requested: mission.Completes, reason: "invalidCompletionCount" }
            : { requested: mission.Completes, allowed: maxCompletes },
        missionReport,
        context,
        getViolationResponse(true)
    );
    if (isAntiCheatSanitizing()) mission.Completes = invalidCompletes ? 0 : maxCompletes;
    return false;
};

/**
 * 校验装备经验增量速率。XP Multiplier 类脚本把本局累积放大数倍后随结算上报，
 * 单看上报值看不出来，但「单位任务时长内的经验量」会明显偏离正常区间。
 *
 * 按比例削减经验需要逐件重算并同步 XPInfo，风险高于收益；reject 模式下由调用方拒绝整份结算。
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
    let invalidXp = false;
    for (const key of equipmentKeys) {
        const gear = missionReport[key];
        if (!Array.isArray(gear)) continue;
        for (const item of gear) {
            if (item.XP !== undefined && (!Number.isSafeInteger(item.XP) || item.XP < 0)) {
                invalidXp = true;
                if (isAntiCheatSanitizing()) item.XP = 0;
                continue;
            }
            totalXp += item.XP ?? 0;
        }
    }
    if (invalidXp) {
        flagSuspicious(
            account,
            "invalidInventoryUpdate",
            { field: "equipment", reason: "invalidExperience" },
            missionReport,
            context,
            getViolationResponse(true)
        );
        return false;
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
        context,
        getViolationResponse(true)
    );
    if (isAntiCheatSanitizing()) {
        for (const key of equipmentKeys) {
            const gear = missionReport[key];
            if (!Array.isArray(gear)) continue;
            for (const item of gear) item.XP = 0;
        }
    }
    return false;
};
