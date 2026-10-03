import mongoose, { Types } from "mongoose";
import { Account } from "../models/loginModel.ts";
import { CurrencyGrantStat } from "../models/currencyGrantStatModel.ts";
import { logger } from "../utils/logger.ts";

export type TCurrencyGrantSource =
    | "mission-aya"
    | "mission-platinum"
    | "pending-platinum"
    | "inventory-add"
    | "starter-pack"
    | "starting-gear"
    | "referral"
    | "admin";

export interface ICurrencyGrantDelta {
    platinum?: number;
    regalAya?: number;
    source: TCurrencyGrantSource;
}

const rewardDayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.TZ ?? "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

export const getCurrencyGrantDay = (date = new Date()): string => {
    const parts = Object.fromEntries(rewardDayFormatter.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const isValidDay = (day: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const date = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) == day;
};

export const recordCurrencyGrant = async (
    accountOwnerId: Types.ObjectId | undefined,
    delta: ICurrencyGrantDelta
): Promise<void> => {
    const platinum = Math.max(0, Math.trunc(delta.platinum ?? 0));
    const regalAya = Math.max(0, Math.trunc(delta.regalAya ?? 0));
    if ((!platinum && !regalAya) || !accountOwnerId || mongoose.connection.readyState !== mongoose.STATES.connected)
        return;

    try {
        await CurrencyGrantStat.updateOne(
            { Day: getCurrencyGrantDay(), AccountOwnerId: accountOwnerId, Source: delta.source },
            { $inc: { Platinum: platinum, RegalAya: regalAya } },
            { upsert: true }
        );
    } catch (error) {
        // Reward delivery must remain available if the optional statistics write is temporarily unavailable.
        logger.error("Could not record currency grant statistics", { error, accountOwnerId, delta });
    }
};

export interface ICurrencyGrantStats {
    day: string;
    totals: { platinum: number; regalAya: number };
    sources: { source: string; platinum: number; regalAya: number }[];
    accounts: { accountId: string; displayName: string; platinum: number; regalAya: number }[];
}

export const getCurrencyGrantStats = async (requestedDay?: string): Promise<ICurrencyGrantStats> => {
    const day = requestedDay || getCurrencyGrantDay();
    if (!isValidDay(day)) throw new Error("day must be an ISO date (YYYY-MM-DD)");

    const rows = await CurrencyGrantStat.find({ Day: day }).lean();
    const accountIds = [...new Set(rows.map(row => row.AccountOwnerId.toString()))].map(id => new Types.ObjectId(id));
    const accounts = await Account.find({ _id: { $in: accountIds } }, "DisplayName").lean();
    const accountNames = new Map(accounts.map(account => [account._id.toString(), account.DisplayName]));
    const accountTotals = new Map<string, { platinum: number; regalAya: number }>();
    const sourceTotals = new Map<string, { platinum: number; regalAya: number }>();

    for (const row of rows) {
        const platinum = row.Platinum;
        const regalAya = row.RegalAya;
        const account = accountTotals.get(row.AccountOwnerId.toString()) ?? { platinum: 0, regalAya: 0 };
        account.platinum += platinum;
        account.regalAya += regalAya;
        accountTotals.set(row.AccountOwnerId.toString(), account);

        const source = sourceTotals.get(row.Source) ?? { platinum: 0, regalAya: 0 };
        source.platinum += platinum;
        source.regalAya += regalAya;
        sourceTotals.set(row.Source, source);
    }

    return {
        day,
        totals: [...accountTotals.values()].reduce(
            (totals, account) => ({
                platinum: totals.platinum + account.platinum,
                regalAya: totals.regalAya + account.regalAya
            }),
            { platinum: 0, regalAya: 0 }
        ),
        sources: [...sourceTotals.entries()]
            .map(([source, values]) => ({ source, ...values }))
            .sort((a, b) => b.platinum + b.regalAya - (a.platinum + a.regalAya)),
        accounts: [...accountTotals.entries()]
            .map(([accountId, values]) => ({
                accountId,
                displayName: accountNames.get(accountId) ?? `(deleted account ${accountId})`,
                ...values
            }))
            .sort(
                (a, b) =>
                    b.platinum + b.regalAya - (a.platinum + a.regalAya) || a.displayName.localeCompare(b.displayName)
            )
    };
};
