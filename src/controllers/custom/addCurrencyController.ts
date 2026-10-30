import type { RequestHandler } from "express";
import { getAccountForRequest, hasPermission } from "../../services/loginService.ts";
import { addCrewShipFusionPoints, addFusionPoints, getInventory } from "../../services/inventoryService.ts";
import { getGuildForRequestEx, hasGuildPermission } from "../../services/guildService.ts";
import { eGuildPermission } from "../../types/guildTypes.ts";
import { broadcastGuildUpdate, broadcastInventoryUpdate } from "../../services/wsService.ts";
import { recordCurrencyGrant } from "../../services/currencyGrantStatService.ts";

export const addCurrencyController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const rawRequest = req.body as Partial<IAddCurrencyRequest> | undefined;
    if (
        rawRequest == null ||
        typeof rawRequest.currency != "string" ||
        !supportedCurrencies.has(rawRequest.currency as IAddCurrencyRequest["currency"]) ||
        typeof rawRequest.delta != "number" ||
        !Number.isSafeInteger(rawRequest.delta)
    ) {
        res.status(400).send("Invalid currency request");
        return;
    }
    const request = rawRequest as IAddCurrencyRequest;
    let projection = request.currency as string;
    if (request.currency.startsWith("Vault")) projection = "GuildId";
    const inventory = await getInventory(account._id, projection);
    if (request.currency == "VaultRegularCredits" || request.currency == "VaultPremiumCredits") {
        const guild = await getGuildForRequestEx(req, inventory);
        if (!(await hasGuildPermission(guild, account._id, eGuildPermission.Treasurer))) {
            res.status(403).send("Permission denied");
            return;
        }
        guild[request.currency] ??= 0;
        guild[request.currency]! += request.delta;
        await guild.save();
        res.json(guild[request.currency]);
        broadcastGuildUpdate(req, guild._id.toString());
    } else {
        if (!hasPermission(account, currencyToPermission[request.currency])) {
            res.status(403).send("Permission denied");
            return;
        }
        switch (request.currency) {
            case "FusionPoints":
                addFusionPoints(inventory, request.delta);
                break;
            case "CrewShipFusionPoints":
                addCrewShipFusionPoints(inventory, request.delta);
                break;
            default:
                inventory[request.currency] += request.delta;
                break;
        }
        if (request.delta > 0) {
            if (request.currency == "PremiumCredits") {
                await recordCurrencyGrant(inventory.accountOwnerId, { platinum: request.delta, source: "admin" });
            } else if (request.currency == "PrimeTokens") {
                await recordCurrencyGrant(inventory.accountOwnerId, { regalAya: request.delta, source: "admin" });
            }
        }
        res.json(inventory[request.currency]);
    }
    if (!request.currency.startsWith("Vault")) {
        await inventory.save();
        broadcastInventoryUpdate(req);
    }
    res.end();
};

interface IAddCurrencyRequest {
    currency:
        | "RegularCredits"
        | "PremiumCredits"
        | "FusionPoints"
        | "CrewShipFusionPoints"
        | "PrimeTokens"
        | "VaultRegularCredits"
        | "VaultPremiumCredits";
    delta: number;
}

const supportedCurrencies = new Set<IAddCurrencyRequest["currency"]>([
    "RegularCredits",
    "PremiumCredits",
    "FusionPoints",
    "CrewShipFusionPoints",
    "PrimeTokens",
    "VaultRegularCredits",
    "VaultPremiumCredits"
]);

const currencyToPermission: Record<string, string> = {
    RegularCredits: "addCredits",
    PremiumCredits: "addPlatinum",
    FusionPoints: "addEndo",
    CrewShipFusionPoints: "addDirac",
    PrimeTokens: "addRegalAya"
};
