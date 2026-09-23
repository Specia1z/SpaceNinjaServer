import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { Account } from "../../models/loginModel.ts";
import { SuspicionEvent } from "../../models/suspicionEventModel.ts";
import { handleNonceInvalidation } from "../../services/wsService.ts";
import type { Types } from "mongoose";

/**
 * 结算反作弊面板的服务端接口。
 *
 * 列表按账号聚合（每个账号每种判定一行计数），明细按需单独拉取 —— 这样即使某个账号被刷出
 * 上万条记录，列表接口的返回体积也不会随之膨胀。
 */

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

const MAX_ACCOUNTS = 200;
const MAX_EVENTS_PER_ACCOUNT = 200;

interface ISuspicionAccountSummary {
    AccountId: string;
    DisplayName: string;
    Banned: boolean;
    Total: number;
    LastSeenAt: Date;
    Counts: Record<string, number>;
}

export const listSuspicionEventsController: RequestHandler = async (req, res) => {
    await getAdministrator(req);

    // 先按 (账号, 判定类型) 聚合。返回行数最多是 账号数 × 4，与事件总量无关。
    const grouped = await SuspicionEvent.aggregate<{
        _id: { AccountId: Types.ObjectId; Kind: string };
        DisplayName: string;
        Count: number;
        LastSeenAt: Date;
    }>([
        {
            $group: {
                _id: { AccountId: "$AccountId", Kind: "$Kind" },
                DisplayName: { $first: "$DisplayName" },
                Count: { $sum: 1 },
                LastSeenAt: { $max: "$CreatedAt" }
            }
        },
        { $sort: { LastSeenAt: -1 } }
    ]);

    const byAccount = new Map<string, ISuspicionAccountSummary>();
    for (const row of grouped) {
        const id = row._id.AccountId.toString();
        let summary = byAccount.get(id);
        if (!summary) {
            summary = {
                AccountId: id,
                DisplayName: row.DisplayName,
                Banned: false,
                Total: 0,
                LastSeenAt: row.LastSeenAt,
                Counts: {}
            };
            byAccount.set(id, summary);
        }
        summary.Total += row.Count;
        summary.Counts[row._id.Kind] = (summary.Counts[row._id.Kind] ?? 0) + row.Count;
        if (row.LastSeenAt > summary.LastSeenAt) {
            summary.LastSeenAt = row.LastSeenAt;
        }
    }

    const summaries = [...byAccount.values()].sort((a, b) => b.LastSeenAt.getTime() - a.LastSeenAt.getTime());

    // 账号当前的显示名与封禁状态以账号表为准；事件里存的名字只作兜底（改名后旧记录仍是旧名）。
    const accounts = await Account.find(
        { _id: { $in: summaries.slice(0, MAX_ACCOUNTS).map(x => x.AccountId) } },
        "DisplayName Banned"
    );
    for (const summary of summaries) {
        const account = accounts.find(x => x._id.toString() == summary.AccountId);
        if (account) {
            summary.DisplayName = account.DisplayName;
            summary.Banned = account.Banned ?? false;
        }
    }

    res.json({
        Accounts: summaries.slice(0, MAX_ACCOUNTS),
        TotalAccounts: summaries.length,
        TotalEvents: summaries.reduce((sum, x) => sum + x.Total, 0)
    });
};

export const getSuspicionEventsForAccountController: RequestHandler = async (req, res) => {
    await getAdministrator(req);

    // Deliberately not "accountId": that query parameter carries the caller's identity, so reusing it
    // here would make the server treat the inspected account as the caller.
    const accountId = req.query.targetAccountId as string | undefined;
    if (!accountId) throw new Error("targetAccountId is required");
    const limit = Math.min(MAX_EVENTS_PER_ACCOUNT, Math.max(1, parseInt(req.query.limit as string) || 50));

    const events = await SuspicionEvent.find({ AccountId: accountId }).sort({ CreatedAt: -1 }).limit(limit);
    res.json({
        AccountId: accountId,
        Events: events.map(event => ({
            Kind: event.Kind,
            Details: event.Details,
            RequestId: event.RequestId,
            BuildLabel: event.BuildLabel,
            MissionStatus: event.MissionStatus,
            MissionTime: event.MissionTime,
            AliveTime: event.AliveTime,
            RemoteAddress: event.RemoteAddress,
            Enforced: event.Enforced,
            MissionTag: event.MissionTag,
            SessionId: event.SessionId,
            CreatedAt: event.CreatedAt
        }))
    });
};

export const clearSuspicionEventsController: RequestHandler = async (req, res) => {
    await getAdministrator(req);

    const body = req.body as { AccountId?: string; All?: boolean };
    let filter: Record<string, unknown>;
    if (body.All === true) {
        filter = {};
    } else if (typeof body.AccountId == "string" && body.AccountId) {
        filter = { AccountId: body.AccountId };
    } else {
        throw new Error("AccountId or All is required");
    }

    const result = await SuspicionEvent.deleteMany(filter);
    res.json({ Deleted: result.deletedCount });
};

export const setAccountBanController: RequestHandler = async (req, res) => {
    await getAdministrator(req);

    const body = req.body as { AccountId?: string; Banned?: boolean };
    if (typeof body.AccountId != "string" || !body.AccountId) {
        throw new Error("AccountId is required");
    }
    const target = await Account.findById(body.AccountId);
    if (!target) {
        throw new Error("Account not found");
    }
    if (isAdministrator(target)) {
        // 管理员不可封禁，否则运维可能把自己锁在门外。
        throw new Error("Administrators cannot be banned");
    }

    target.Banned = body.Banned === true;
    if (target.Banned) {
        // 清掉 nonce 让已登录的客户端立刻失效（后续请求会因 nonce 不匹配被拒），
        // 再广播一次会话失效，在线对局会立刻掉线。
        target.Nonce = 0;
    }
    await target.save();
    if (target.Banned) {
        handleNonceInvalidation(target._id.toString());
    }

    res.json({
        AccountId: target._id.toString(),
        DisplayName: target.DisplayName,
        Banned: target.Banned ?? false
    });
};
