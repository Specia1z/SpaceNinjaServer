import { model, Schema } from "mongoose";
import type { Types } from "mongoose";

/**
 * 结算反作弊的判定结果落库，供管理面板查询与封禁取证。
 *
 * 只记录"会过网络"的手法：纯本地改动（透视/无敌/无限弹药等）不产生上行数据，
 * 服务端拿不到任何证据，也就无从记录。
 */

const suspicionKinds = [
    "rewardSeedMismatch",
    "impossibleMissionTime",
    "excessiveMissionCompletes",
    "excessiveXpGain"
] as const;

export type TSuspicionKind = (typeof suspicionKinds)[number];

export interface ISuspicionEvent {
    // 触发判定的账号。
    AccountId: Types.ObjectId;

    // 冗余存一份显示名，面板列表就不必回表查账号（改名后旧记录仍是旧名，可接受）。
    DisplayName: string;

    Kind: TSuspicionKind;

    // 判定所依据的数值证据，原样存下，便于人工复核。
    Details: Record<string, unknown>;

    // 触发时的任务与对局，便于定位是哪一局。
    MissionTag?: string;
    SessionId?: string;

    CreatedAt: Date;
}

// 保留 90 天。封禁取证够用，又不会无限增长。
const SUSPICION_EVENT_TTL_SECONDS = 90 * 24 * 3600;

const suspicionEventSchema = new Schema<ISuspicionEvent>({
    AccountId: { type: Schema.Types.ObjectId, required: true },
    DisplayName: { type: String, required: true },
    Kind: { type: String, required: true, enum: suspicionKinds },
    Details: { type: Schema.Types.Mixed, required: true },
    MissionTag: String,
    SessionId: String,
    CreatedAt: { type: Date, required: true, default: (): Date => new Date() }
});

suspicionEventSchema.index({ CreatedAt: 1 }, { expireAfterSeconds: SUSPICION_EVENT_TTL_SECONDS });
// 面板按账号聚合并按时间倒序取最近记录。
suspicionEventSchema.index({ AccountId: 1, CreatedAt: -1 });

export const SuspicionEvent = model<ISuspicionEvent>("SuspicionEvent", suspicionEventSchema);
