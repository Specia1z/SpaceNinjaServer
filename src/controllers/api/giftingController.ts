import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import { Account } from "../../models/loginModel.ts";
import { areFriends } from "../../services/friendService.ts";
import { createMessage } from "../../services/inboxService.ts";
import {
    combineInventoryChanges,
    CurrencyType,
    getEffectiveAvatarImageType,
    getInventory,
    updateCurrency
} from "../../services/inventoryService.ts";
import { getAccountForRequest, getBuildLabel, getSuffixedName } from "../../services/loginService.ts";
import { handleDailyDealPurchase, handleStoreItemAcquisition } from "../../services/purchaseService.ts";
import type { IOid } from "../../types/commonTypes.ts";
import type { IPurchaseParams, IPurchaseResponse } from "../../types/purchaseTypes.ts";
import { ePurchaseSource } from "../../types/purchaseTypes.ts";
import type { RequestHandler } from "express";
import { ExportFlavour } from "warframe-public-export-plus";
import { fromStoreItem, getBundle, getPrice, isBundle } from "../../services/itemDataService.ts";
import { getStoreItemGiftBonus, isStoreItemGiftable } from "../../services/storeOverrideService.ts";

const checkPurchaseParams = (params: IPurchaseParams): boolean => {
    switch (params.Source) {
        case ePurchaseSource.Market:
            return params.UsePremium;

        case ePurchaseSource.DailyDeal:
            return true;
    }
    return false;
};

export const giftingController: RequestHandler = async (req, res) => {
    const data = getJSONfromString<IGiftingRequest>(String(req.body));
    if (!data.PurchaseParams) {
        const nameParts = String(req.query.productName).split(";");
        data.PurchaseParams = {
            Source: ePurchaseSource.Market,
            StoreItem: nameParts[0],
            Quantity: Number(req.query.quantity),
            UsePremium: true
        };
        if (nameParts[1]) data.PurchaseParams.Durability = Number(nameParts[1]);
    }
    if (!checkPurchaseParams(data.PurchaseParams)) {
        throw new Error(`unexpected purchase params in gifting request: ${String(req.body)}`);
    }

    const account = await Account.findOne(
        data.RecipientId ? { _id: data.RecipientId.$oid } : { DisplayName: data.Recipient }
    );
    if (!account) {
        res.status(400).send("9").end();
        return;
    }
    const inventory = await getInventory(account._id, "Suits Settings");

    // Cannot gift items to players that have not completed the tutorial.
    if (inventory.Suits.length == 0) {
        res.status(400).send("14").end();
        return;
    }

    // Cannot gift to players who have gifting disabled.
    const senderAccount = await getAccountForRequest(req);
    const senderBuildLabel = getBuildLabel(req, senderAccount);
    if (
        inventory.Settings?.GiftMode == "GIFT_MODE_NONE" ||
        (inventory.Settings?.GiftMode == "GIFT_MODE_FRIENDS" && !(await areFriends(account._id, senderAccount._id)))
    ) {
        res.status(400).send("17").end();
        return;
    }

    // TODO: Cannot gift items with mastery requirement to players who are too low level. (Code 2)
    // TODO: Cannot gift archwing items to players that have not completed the archwing quest. (Code 7)
    // TODO: Cannot gift necramechs to players that have not completed heart of deimos. (Code 20)

    const senderInventory = await getInventory(senderAccount._id, undefined);

    if (!senderInventory.infiniteGifts) {
        if (senderInventory.GiftsRemaining == 0) {
            res.status(400).send("10").end();
            return;
        }
        senderInventory.GiftsRemaining -= 1;
    }

    const response: IPurchaseResponse = {
        InventoryChanges: {}
    };
    if (data.PurchaseParams.Source == ePurchaseSource.DailyDeal) {
        await handleDailyDealPurchase(senderInventory, data.PurchaseParams, response);
    } else {
        const typeName = isBundle(data.PurchaseParams.StoreItem)
            ? data.PurchaseParams.StoreItem
            : fromStoreItem(data.PurchaseParams.StoreItem);
        if (!isStoreItemGiftable(typeName)) {
            throw new Error("item is not currently giftable");
        }
        const price = getPrice(
            data.PurchaseParams.StoreItem,
            data.PurchaseParams.Quantity,
            data.PurchaseParams.Durability,
            data.PurchaseParams.UsePremium,
            senderBuildLabel
        );
        if (data.PurchaseParams.ExpectedPrice !== undefined && data.PurchaseParams.ExpectedPrice !== price) {
            throw new Error("market price changed; refresh the market and try again");
        }
        data.PurchaseParams.ExpectedPrice = price;
        updateCurrency(senderInventory, price, CurrencyType.PAID_PLATINUM, response.InventoryChanges);
    }
    const giftingBonus =
        getStoreItemGiftBonus(data.PurchaseParams.StoreItem) ??
        (isBundle(data.PurchaseParams.StoreItem)
            ? getBundle(data.PurchaseParams.StoreItem, senderBuildLabel)?.giftingBonus
            : undefined);
    if (giftingBonus) {
        combineInventoryChanges(
            response.InventoryChanges,
            (
                await handleStoreItemAcquisition(
                    giftingBonus,
                    senderInventory,
                    1,
                    3,
                    false,
                    true,
                    undefined,
                    senderBuildLabel
                )
            ).InventoryChanges
        );
    }
    await senderInventory.save();

    const senderName = getSuffixedName(senderAccount);
    await createMessage(account._id, [
        {
            sndr: senderName,
            msg: data.Message || "/Lotus/Language/Menu/GiftReceivedBody_NoCustomMessage",
            arg: [
                {
                    Key: "GIFTER_NAME",
                    Tag: senderName
                },
                {
                    Key: "GIFT_QUANTITY",
                    Tag: data.PurchaseParams.Quantity
                }
            ],
            sub: "/Lotus/Language/Menu/GiftReceivedSubject",
            icon: ExportFlavour[getEffectiveAvatarImageType(senderInventory)].icon,
            gifts: [
                {
                    GiftType: data.PurchaseParams.StoreItem
                }
            ]
        }
    ]);

    res.json(response);
};

interface IGiftingRequest {
    PurchaseParams?: IPurchaseParams;
    Message?: string;
    Recipient?: string;
    RecipientId?: IOid;
    buildLabel?: string; // not provided in U18
}
