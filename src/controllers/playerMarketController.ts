import type { RequestHandler } from "express";
import { config, type IPlayerMarketConfig } from "../services/configService.ts";
import {
    getPlayerMarketConfig,
    getPlayerMarketSummary,
    tradePlayerMarket,
    type TMarketAction,
    validatePlayerMarketField,
    validatePlayerMarketPolicy
} from "../services/playerMarketService.ts";
import { getAccountForAdmin } from "./playerPortalController.ts";
import { getPlayerAccount } from "../services/playerPortalService.ts";
import { saveConfig } from "../services/configWriterService.ts";

const bodyOf = (req: Parameters<RequestHandler>[0]): Record<string, unknown> =>
    (req.body && typeof req.body == "object" ? req.body : {}) as Record<string, unknown>;

const sendError = (res: Parameters<RequestHandler>[1], status: number, error: string): void => {
    res.status(status).json({ error });
};

const marketErrorStatus = (error: string): number => {
    if (error == "market_insufficient_funds") return 402;
    if (error == "market_account_too_new") return 403;
    if (error == "market_account_limit" || error == "market_global_limit") return 429;
    if (
        error == "market_inventory_changed" ||
        error == "market_system_inventory_unavailable" ||
        error == "market_stock_changed"
    )
        return 409;
    return 400;
};

export const getPlayerMarketController: RequestHandler = async (req, res) => {
    const account = await getPlayerAccount(req);
    if (!account) return sendError(res, 401, "login_required");
    res.json(await getPlayerMarketSummary(account._id));
};

const trade = async (
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1],
    side: TMarketAction
): Promise<void> => {
    const account = await getPlayerAccount(req);
    if (!account) return sendError(res, 401, "login_required");
    const body = bodyOf(req);
    try {
        const result = await tradePlayerMarket(account, side, body);
        res.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "market_trade_failed";
        sendError(res, marketErrorStatus(message), message);
    }
};

export const playerMarketSellController: RequestHandler = (req, res) => trade(req, res, "sell");
export const playerMarketBuyController: RequestHandler = (req, res) => trade(req, res, "buy");
export const getPlayerMarketAdminController: RequestHandler = async (req, res) => {
    const account = await getAccountForAdmin(req, res);
    if (account) res.json({ ...getPlayerMarketConfig(), ...config.playerMarket });
};

export const setPlayerMarketAdminController: RequestHandler = async (req, res) => {
    const account = await getAccountForAdmin(req, res);
    if (!account) return;
    const next = bodyOf(req) as unknown as IPlayerMarketConfig;
    const merged = { ...getPlayerMarketConfig(), ...next };
    if (!validatePlayerMarketPolicy(merged)) return sendError(res, 400, "invalid_market_policy");
    for (const [key, value] of Object.entries(merged)) {
        const error = validatePlayerMarketField(`playerMarket.${key}`, value);
        if (error) return sendError(res, 400, error);
    }
    config.playerMarket = merged;
    await saveConfig();
    res.json(merged);
};
