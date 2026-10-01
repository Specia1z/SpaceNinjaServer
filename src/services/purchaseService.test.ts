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

void test("market prices cover unexported sentinel skins", async () => {
    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        PremiumCredits: 100,
        PremiumCreditsFree: 0
    });

    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Market,
                StoreItem: "/Lotus/StoreItems/Upgrades/Skins/Sentinels/Skins/BansheeDlxSentSkin",
                Quantity: 1,
                UsePremium: true,
                ExpectedPrice: 40
            },
            buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
        },
        inventory
    );

    assert.deepEqual(
        response.InventoryChanges.WeaponSkins?.map(item => item.ItemType),
        ["/Lotus/Upgrades/Skins/Sentinels/Skins/BansheeDlxSentSkin"]
    );
    assert.equal(response.InventoryChanges.PremiumCredits, -40);
    assert.equal(inventory.PremiumCredits, 60);
});

void test("market booster packages honor duration prices", async () => {
    for (const booster of [
        {
            storeItem: "/Lotus/Types/StoreItems/Boosters/ResourceAmount3DayStoreItem",
            price: 40,
            durationDays: 3
        },
        {
            storeItem: "/Lotus/Types/StoreItems/Boosters/ResourceAmount7DayStoreItem",
            price: 80,
            durationDays: 7
        },
        {
            storeItem: "/Lotus/Types/StoreItems/Boosters/ResourceAmount30DayStoreItem",
            price: 200,
            durationDays: 30
        }
    ]) {
        const inventory = new Inventory({
            accountOwnerId: "000000000000000000000001",
            PremiumCredits: booster.price,
            PremiumCreditsFree: 0
        });

        const response = await handlePurchase(
            {
                PurchaseParams: {
                    Source: ePurchaseSource.Market,
                    StoreItem: booster.storeItem,
                    Quantity: 1,
                    UsePremium: true,
                    ExpectedPrice: booster.price
                },
                buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
            },
            inventory
        );

        assert.equal(response.InventoryChanges.PremiumCredits, -booster.price);
        assert.deepEqual(response.InventoryChanges.Boosters, [
            {
                ItemType: "/Lotus/Types/Boosters/ResourceAmountBooster",
                ExpiryDate: booster.durationDays * 86400
            }
        ]);
        assert.equal(inventory.PremiumCredits, 0);
    }
});

void test("market fusion bundles grant their advertised fusion points", async () => {
    for (const fusionBundle of [
        {
            storeItem: "/Lotus/StoreItems/Upgrades/Mods/FusionBundles/MarketTier1FusionBundle",
            price: 5,
            fusionPoints: 100
        },
        {
            storeItem: "/Lotus/StoreItems/Upgrades/Mods/FusionBundles/MarketTier2FusionBundle",
            price: 15,
            fusionPoints: 400
        },
        {
            storeItem: "/Lotus/StoreItems/Upgrades/Mods/FusionBundles/MarketTier3FusionBundle",
            price: 50,
            fusionPoints: 1000
        }
    ]) {
        const inventory = new Inventory({
            accountOwnerId: "000000000000000000000001",
            PremiumCredits: fusionBundle.price,
            PremiumCreditsFree: 0
        });

        const response = await handlePurchase(
            {
                PurchaseParams: {
                    Source: ePurchaseSource.Market,
                    StoreItem: fusionBundle.storeItem,
                    Quantity: 1,
                    UsePremium: true,
                    ExpectedPrice: fusionBundle.price
                },
                buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
            },
            inventory
        );

        assert.equal(response.InventoryChanges.FusionPoints, fusionBundle.fusionPoints);
        assert.equal(response.InventoryChanges.PremiumCredits, -fusionBundle.price);
        assert.equal(inventory.FusionPoints, fusionBundle.fusionPoints);
        assert.equal(inventory.PremiumCredits, 0);
    }
});
