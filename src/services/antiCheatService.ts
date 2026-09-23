import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";
import { getSessionByID } from "./sessionService.ts";
import { equipmentKeys } from "../types/inventoryTypes/inventoryTypes.ts";
import type { TAccountDocument } from "./loginService.ts";
import type { IMission } from "../types/inventoryTypes/inventoryTypes.ts";
import type { IMissionInventoryUpdateRequest } from "../types/requestTypes.ts";

/*
 * 结算上行报文的反作弊校验。
 *
 * 只有「会过网络」的作弊手法才可能在这里被抓住 —— 透视、无敌、无限弹药、传送这类纯本地
 * 改动不产生任何上行数据，服务端无从取证。本模块覆盖的是**写入结算包**的那一类：
 * 客户端在 deflate 之前原地改写 ezip 明文，就能伪造结算种子、任务时长、完成次数与经验增量。
 *
 * 所有阈值来自 config.antiCheat，默认只记日志（enforce=false）不改变任何行为。
 */

type TSuspicionKind = "rewardSeedMismatch" | "impossibleMissionTime" | "excessiveMissionCompletes" | "excessiveXpGain";

const isEnabled = (): boolean => config.antiCheat?.enabled ?? true;

/** enforce 关闭时所有检测只出日志，不影响结算结果。 */
export const isAntiCheatEnforcing = (): boolean => isEnabled() && (config.antiCheat?.enforce ?? false);

/** 所有可疑判定统一从这里出日志，便于运维 grep，也便于以后接审计或封禁。 */
const flagSuspicious = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    kind: TSuspicionKind,
    details: Record<string, unknown>
): void => {
    logger.warn(`[anti-cheat] ${kind}`, {
        account: account._id.toString(),
        displayName: account.DisplayName,
        ...details
    });
};

/** 会话种子可能是 number（mongoose 读出）也可能是 bigint，统一成 bigint 再比。 */
const toBigInt = (value: number | bigint): bigint | null => {
    if (typeof value == "bigint") return value;
    return Number.isInteger(value) ? BigInt(value) : null;
};

/**
 * 校验客户端上报的 rewardSeed 是否与服务端在 hostSession / joinSession 时下发的种子一致。
 *
 * 该种子是结算奖励 RNG 的唯一输入（服务端用 SRng(seed ^ 0xffffffffffffffff) 洗任务奖励），
 * 而且客户端上报什么就用什么 —— 所以只要在 ezip 明文里把它改掉，就能定点开出任意奖励。
 * 检测依据很直接：会话创建时服务端已经把这个种子存进 Session 文档，上报值必须与之一致。
 *
 * enforce 开启时**不拒绝结算**，而是把上报值改回服务端种子：奖励回到正常 roll，
 * 既不会连带吞掉正常掉落，也不存在误判导致玩家颗粒无收的风险。
 *
 * @returns 一致（或无法判定）时返回 true。
 */
export const verifyRewardSeed = async (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest
): Promise<boolean> => {
    if (!isEnabled()) return true;

    const rewardInfo = missionReport.RewardInfo;
    if (rewardInfo == undefined) return true;
    const reportedSeed = rewardInfo.rewardSeed;
    if (reportedSeed == undefined) return true;

    // sharedSessionId 是裸 ObjectId 十六进制串（实机报文核实）。会话有 5 分钟 TTL，过期即查不到。
    const sessionId = missionReport.sharedSessionId;
    if (!sessionId) return true;
    const session = await getSessionByID(sessionId);
    if (session == null) return true;

    const expected = toBigInt(session.rewardSeed);
    const actual = toBigInt(reportedSeed);
    if (expected == null || actual == null || actual == expected) return true;

    flagSuspicious(account, "rewardSeedMismatch", {
        sessionId,
        reported: actual.toString(),
        expected: expected.toString(),
        missionTag: missionReport.Missions?.Tag
    });
    if (isAntiCheatEnforcing()) {
        rewardInfo.rewardSeed = expected;
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
    missionReport: IMissionInventoryUpdateRequest
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
        flagSuspicious(account, "impossibleMissionTime", {
            missionTime: missionReport.MissionTime,
            minMissionTimeSec: minTimeSec,
            missionTag: missionReport.Missions?.Tag
        });
        ok = false;
    }
    if (missionReport.AliveTime > missionReport.MissionTime) {
        flagSuspicious(account, "impossibleMissionTime", {
            aliveTime: missionReport.AliveTime,
            missionTime: missionReport.MissionTime,
            reason: "aliveTimeExceedsMissionTime"
        });
        ok = false;
    }
    return ok;
};

/**
 * 限制单次结算能计入的任务完成次数。正常结算 Completes 恒为 1（实机报文核实），
 * 而原本的实现是 `Completes += 客户端值`，没有上界。
 *
 * 这里直接夹紧而不是只记日志：合法报文的 Completes 远低于任何合理上限，夹紧没有误判风险。
 */
export const clampMissionCompletes = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    mission: IMission
): IMission => {
    if (!isEnabled()) return mission;

    const maxCompletes = config.antiCheat?.maxMissionCompletesPerReport ?? 10;
    if (maxCompletes <= 0 || mission.Completes <= maxCompletes) return mission;

    flagSuspicious(account, "excessiveMissionCompletes", {
        missionTag: mission.Tag,
        requested: mission.Completes,
        allowed: maxCompletes
    });
    return { ...mission, Completes: maxCompletes };
};

/**
 * 校验装备经验增量速率。XP Multiplier 类脚本把本局累积放大数倍后随结算上报，
 * 单看上报值看不出来，但「单位任务时长内的经验量」会明显偏离正常区间。
 *
 * 只判定不修改：按比例削减经验需要逐件重算并同步 XPInfo，风险高于收益；抓到后由运维处置。
 */
export const verifyXpGain = (
    account: Pick<TAccountDocument, "_id" | "DisplayName">,
    missionReport: IMissionInventoryUpdateRequest
): void => {
    if (!isEnabled()) return;

    const maxPerSecond = config.antiCheat?.maxXpPerMissionSecond ?? 100000;
    if (maxPerSecond <= 0) return;

    let totalXp = 0;
    for (const key of equipmentKeys) {
        const gear = missionReport[key];
        if (!Array.isArray(gear)) continue;
        for (const item of gear) {
            totalXp += item.XP ?? 0;
        }
    }
    if (totalXp <= 0) return;

    const seconds = Math.max(missionReport.MissionTime, 1);
    if (totalXp / seconds <= maxPerSecond) return;

    flagSuspicious(account, "excessiveXpGain", {
        totalXp,
        missionTime: seconds,
        xpPerSecond: Math.round(totalXp / seconds),
        maxXpPerMissionSecond: maxPerSecond
    });
};
