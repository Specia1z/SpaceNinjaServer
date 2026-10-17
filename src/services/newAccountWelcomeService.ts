import type { Types } from "mongoose";
import type { ITypeCount } from "../types/commonTypes.ts";
import { createMessage, type IMessageCreationTemplate } from "./inboxService.ts";
import { config, type INewAccountWelcomeConfig, type INewAccountWelcomeReward } from "./configService.ts";

const MAX_REWARDS = 100;
const MAX_REWARD_QUANTITY = 999_999_999;
const MAX_TEXT_LENGTH = 10_000;
const CURRENCY_ITEM_TYPES = new Set([
    "RegularCredits",
    "PremiumCredits",
    "PremiumCreditsFree",
    "FusionPoints",
    "CrewShipFusionPoints",
    "PrimeTokens"
]);

export const DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG: Required<INewAccountWelcomeConfig> = {
    enabled: false,
    sender: "PlayWF",
    subject: "Welcome to PlayWF",
    body: "Welcome to PlayWF, Tenno! Thank you for joining us. Your starter rewards are attached to this message.",
    icon: "/Lotus/Interface/Icons/Npcs/Lotus_d.png",
    rewards: [{ ItemType: "PremiumCredits", ItemCount: 200 }]
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value == "object" && !Array.isArray(value);

const readText = (value: unknown, fallback: string, field: string, maxLength: number): string => {
    const text = value === undefined ? fallback : value;
    if (typeof text != "string" || !text.trim() || text.length > maxLength || /[\r\n]/.test(text)) {
        throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters`);
    }
    return text.trim();
};

const readBody = (value: unknown): string => {
    const body = value === undefined ? DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.body : value;
    if (typeof body != "string" || !body.trim() || body.length > MAX_TEXT_LENGTH) {
        throw new Error(`body must be a non-empty string of at most ${MAX_TEXT_LENGTH} characters`);
    }
    return body.trim();
};

const normalizeRewards = (value: unknown): INewAccountWelcomeReward[] => {
    if (!Array.isArray(value)) throw new Error("rewards must be an array");
    if (value.length > MAX_REWARDS) throw new Error(`rewards may contain at most ${MAX_REWARDS} entries`);

    const quantities = new Map<string, number>();
    for (const reward of value) {
        if (!isRecord(reward)) throw new Error("Each reward must be an object");
        const itemType = reward.ItemType;
        const itemCount = reward.ItemCount;
        if (
            typeof itemType != "string" ||
            !itemType.trim() ||
            itemType.length > 300 ||
            /[\r\n\s]/.test(itemType) ||
            (!itemType.startsWith("/Lotus/") && !CURRENCY_ITEM_TYPES.has(itemType))
        ) {
            throw new Error("Each reward ItemType must be a currency name or a /Lotus/ item path");
        }
        if (
            typeof itemCount != "number" ||
            !Number.isSafeInteger(itemCount) ||
            itemCount < 1 ||
            itemCount > MAX_REWARD_QUANTITY
        ) {
            throw new Error(`Each reward ItemCount must be a whole number from 1 to ${MAX_REWARD_QUANTITY}`);
        }
        const normalizedType = itemType.trim();
        const total = (quantities.get(normalizedType) ?? 0) + itemCount;
        if (total > MAX_REWARD_QUANTITY) throw new Error(`Reward quantity for ${normalizedType} is too large`);
        quantities.set(normalizedType, total);
    }

    return [...quantities].map(([ItemType, ItemCount]) => ({ ItemType, ItemCount }));
};

export const normalizeNewAccountWelcomeConfig = (value: unknown): Required<INewAccountWelcomeConfig> => {
    const source = isRecord(value) ? value : {};
    if (source.enabled !== undefined && typeof source.enabled != "boolean") {
        throw new Error("enabled must be a boolean");
    }
    const icon =
        source.icon === undefined || source.icon === "" ? DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.icon : source.icon;
    if (typeof icon != "string" || icon.length > 300 || /[\r\n]/.test(icon)) {
        throw new Error("icon must be at most 300 characters");
    }
    return {
        enabled: source.enabled ?? DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.enabled,
        sender: readText(source.sender, DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.sender, "sender", 100),
        subject: readText(source.subject, DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.subject, "subject", 200),
        body: readBody(source.body),
        icon: icon.trim(),
        rewards:
            source.rewards === undefined
                ? [...DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.rewards]
                : normalizeRewards(source.rewards)
    };
};

export const getNewAccountWelcomeConfig = (): Required<INewAccountWelcomeConfig> => {
    try {
        return normalizeNewAccountWelcomeConfig(config.playwfFeatures?.newAccountWelcome);
    } catch {
        return { ...DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG, rewards: [...DEFAULT_NEW_ACCOUNT_WELCOME_CONFIG.rewards] };
    }
};

export const buildNewAccountWelcomeMessage = (
    settings: INewAccountWelcomeConfig
): IMessageCreationTemplate | undefined => {
    const normalized = normalizeNewAccountWelcomeConfig(settings);
    if (!normalized.enabled) return undefined;

    const message: IMessageCreationTemplate = {
        sndr: normalized.sender,
        sub: normalized.subject,
        msg: normalized.body,
        icon: normalized.icon,
        highPriority: true
    };
    const countedAtt: ITypeCount[] = [];

    for (const reward of normalized.rewards) {
        if (reward.ItemType == "RegularCredits") {
            message.RegularCredits = (message.RegularCredits ?? 0) + reward.ItemCount;
        } else if (reward.ItemType == "PremiumCredits") {
            message.PremiumCredits = (message.PremiumCredits ?? 0) + reward.ItemCount;
        } else if (reward.ItemType == "PrimeTokens") {
            message.PrimeTokens = (message.PrimeTokens ?? 0) + reward.ItemCount;
        } else {
            countedAtt.push({ ItemType: reward.ItemType, ItemCount: reward.ItemCount });
        }
    }
    if (countedAtt.length > 0) message.countedAtt = countedAtt;
    return message;
};

export const sendNewAccountWelcomeMessage = async (accountId: string | Types.ObjectId): Promise<boolean> => {
    const message = buildNewAccountWelcomeMessage(getNewAccountWelcomeConfig());
    if (!message) return false;
    await createMessage(accountId, [message]);
    return true;
};
