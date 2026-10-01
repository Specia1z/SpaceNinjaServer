import assert from "node:assert/strict";
import { test } from "node:test";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { ePurchaseSource } from "../types/purchaseTypes.ts";
import { handlePurchase } from "./purchaseService.ts";

void test("Narin bundle stores skins as WeaponSkins", async () => {
    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        PremiumCredits: 2000,
        PremiumCreditsFree: 0
    });

    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Market,
                StoreItem: "/Lotus/Types/StoreItems/Packages/WarframeBundles/NarinItemsBundle",
                Quantity: 1,
                UsePremium: true,
                ExpectedPrice: 990
            },
            buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
        },
        inventory
    );

    assert.deepEqual(
        response.InventoryChanges.WeaponSkins?.map(item => item.ItemType),
        [
            "/Lotus/Upgrades/Skins/Duelist/DuelistAltHelmet",
            "/Lotus/Upgrades/Skins/Scarves/DuelistSyandana",
            "/Lotus/Upgrades/Skins/Effects/DuelistEphemera",
            "/Lotus/Upgrades/Skins/Crowns/DuelistCrown"
        ]
    );
    assert.deepEqual(
        response.InventoryChanges.FlavourItems?.map(item => item.ItemType),
        ["/Lotus/Types/Items/Emotes/DuelistEmote"]
    );
    assert.deepEqual(
        response.InventoryChanges.ShipDecorations?.map(item => item.ItemType),
        ["/Lotus/Types/Items/ShipDecos/Props/LisetPropIceblade"]
    );
    assert.equal(response.InventoryChanges.PremiumCredits, -990);
    assert.equal(inventory.PremiumCredits, 1010);
});
