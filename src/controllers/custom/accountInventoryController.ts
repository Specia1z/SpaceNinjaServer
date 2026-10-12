import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Account } from "../../models/loginModel.ts";
import { addItem, addMods, getInventory } from "../../services/inventoryService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { sendWsBroadcastToGame } from "../../services/wsService.ts";
import { BL_LATEST } from "../../constants/gameVersions.ts";

const requireAdministrator = async (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return undefined;
    }
    return account;
};

const getTargetAccountId = (value: unknown): string | undefined =>
    typeof value === "string" && Types.ObjectId.isValid(value) ? value : undefined;

export const getAccountInventoryController: RequestHandler = async (req, res) => {
    if (!(await requireAdministrator(req, res))) return;
    const accountId = getTargetAccountId(req.query.targetAccountId);
    if (!accountId) {
        res.status(400).send("A valid accountId is required");
        return;
    }
    const account = await Account.findById(accountId, "DisplayName").lean();
    if (!account) {
        res.status(404).send("Account not found");
        return;
    }
    const inventory = await getInventory(new Types.ObjectId(accountId), undefined);
    res.json({ accountId, displayName: account.DisplayName, ...inventory.toJSON() });
};

type AccountModRequest = {
    accountId?: unknown;
    action?: unknown;
    oid?: unknown;
    itemType?: unknown;
    itemCount?: unknown;
    fingerprint?: unknown;
    currency?: unknown;
    delta?: unknown;
    items?: unknown;
    source?: unknown;
    itemId?: unknown;
};

export const updateAccountModController: RequestHandler = async (req, res) => {
    if (!(await requireAdministrator(req, res))) return;
    const body = req.body as AccountModRequest | undefined;
    const accountId = getTargetAccountId(body?.accountId);
    if (!accountId || !(await Account.exists({ _id: accountId }))) {
        res.status(400).send("A valid accountId is required");
        return;
    }
    const inventory = await getInventory(new Types.ObjectId(accountId), undefined);

    if (body?.action === "addCurrency") {
        const currency = body.currency;
        const delta = body.delta;
        if (
            typeof currency !== "string" ||
            !["RegularCredits", "PremiumCredits", "FusionPoints", "CrewShipFusionPoints", "PrimeTokens"].includes(currency) ||
            typeof delta !== "number" ||
            !Number.isSafeInteger(delta) ||
            delta === 0
        ) {
            res.status(400).send("A valid currency and non-zero integer delta are required");
            return;
        }
        if ((inventory as unknown as Record<string, number>)[currency] + delta < 0) {
            res.status(400).send("Currency balance cannot become negative");
            return;
        }
        await addItem(inventory, currency, delta, true, undefined, undefined, true, BL_LATEST);
    } else if (body?.action === "grantItems") {
        if (!Array.isArray(body.items) || body.items.length === 0) {
            res.status(400).send("A non-empty items array is required");
            return;
        }
        for (const item of body.items) {
            if (!item || typeof item !== "object") {
                res.status(400).send("Invalid item grant");
                return;
            }
            const request = item as { ItemType?: unknown; ItemCount?: unknown; Fingerprint?: unknown };
            if (
                typeof request.ItemType !== "string" ||
                !request.ItemType ||
                typeof request.ItemCount !== "number" ||
                !Number.isSafeInteger(request.ItemCount) ||
                request.ItemCount === 0 ||
                (request.Fingerprint !== undefined && typeof request.Fingerprint !== "string") ||
                (request.ItemCount < 0 && request.Fingerprint !== undefined)
            ) {
                res.status(400).send("Invalid item grant");
                return;
            }
            await addItem(inventory, request.ItemType, request.ItemCount, true, undefined, request.Fingerprint, true, BL_LATEST);
        }
    } else if (body?.action === "deleteItem") {
        const source = body.source;
        const itemType = body.itemType;
        const itemId = body.itemId;
        const itemCount = body.itemCount;
        const allowedSources = new Set([
            "Suits", "SpaceSuits", "MechSuits", "Hoverboards", "Motorcycles", "CrewShips", "CrewShipHarnesses",
            "LongGuns", "Pistols", "Melee", "SpecialItems", "SentinelWeapons", "SpaceGuns", "SpaceMelee",
            "OperatorAmps", "DrifterGuns", "DrifterMelee", "DataKnives", "CrewShipWeapons", "CrewShipSalvagedWeapons",
            "Sentinels", "KubrowPets", "MoaPets", "Horses", "RawUpgrades", "Upgrades", "MiscItems", "OperatorSuits",
            "WeaponSkins", "Recipes", "Consumables", "LevelKeys", "Antiques", "Scoops"
        ]);
        if (
            typeof source !== "string" || !allowedSources.has(source) ||
            typeof itemType !== "string" || !itemType ||
            typeof itemCount !== "number" || !Number.isSafeInteger(itemCount) || itemCount < 1 ||
            (itemId !== undefined && typeof itemId !== "string")
        ) {
            res.status(400).send("A valid inventory item is required");
            return;
        }
        const items = (inventory as unknown as Record<string, { ItemType?: string; ItemCount?: number; _id?: { toString(): string } }[]>)[source];
        if (!Array.isArray(items)) {
            res.status(400).send("Invalid inventory source");
            return;
        }
        const index = items.findIndex(item =>
            item.ItemType === itemType && (itemId === undefined || item._id?.toString() === itemId)
        );
        if (index < 0) {
            res.status(404).send("Inventory item not found");
            return;
        }
        if (itemId !== undefined || source === "Upgrades") {
            items.splice(index, 1);
        } else {
            await addItem(inventory, itemType, -itemCount, true, undefined, undefined, true, BL_LATEST);
        }
    } else if (body?.action === "deleteMod") {
        if (typeof body.oid === "string") {
            const index = inventory.Upgrades.findIndex(item => item._id.toString() === body.oid);
            if (index < 0) {
                res.status(404).send("Mod not found");
                return;
            }
            inventory.Upgrades.splice(index, 1);
        } else if (typeof body.itemType === "string" && typeof body.itemCount === "number" && Number.isSafeInteger(body.itemCount) && body.itemCount > 0) {
            addMods(inventory, [{ ItemType: body.itemType, ItemCount: -body.itemCount }]);
        } else {
            res.status(400).send("A mod oid or itemType and itemCount are required");
            return;
        }
    } else if (body?.action === "updateFingerprint") {
        if (typeof body.oid !== "string" || !body.fingerprint || typeof body.fingerprint !== "object") {
            res.status(400).send("A valid oid and fingerprint are required");
            return;
        }
        const item = inventory.Upgrades.id(body.oid);
        if (!item) {
            res.status(404).send("Mod not found");
            return;
        }
        item.UpgradeFingerprint = JSON.stringify(body.fingerprint);
    } else if (body?.action === "grant") {
        if (typeof body.itemType !== "string" || !body.itemType || typeof body.itemCount !== "number" || body.itemCount < 1) {
            res.status(400).send("A valid itemType and itemCount are required");
            return;
        }
        await addItem(
            inventory,
            body.itemType,
            Math.floor(body.itemCount),
            true,
            undefined,
            typeof body.fingerprint === "string" ? body.fingerprint : undefined,
            true,
            BL_LATEST
        );
    } else {
        res.status(400).send("Unknown account Mod action");
        return;
    }

    await inventory.save();
    res.end();
    sendWsBroadcastToGame(accountId, { sync_inventory: true });
};
