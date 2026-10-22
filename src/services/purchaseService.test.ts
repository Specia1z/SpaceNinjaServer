import assert from "node:assert/strict";
import { test } from "node:test";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { ROAD_TO_TAU_CURRENCY, ROAD_TO_TAU_VENDOR } from "../constants/roadToTauVendor.ts";
import { ePurchaseSource } from "../types/purchaseTypes.ts";
import { handlePurchase } from "./purchaseService.ts";
import { getVendor } from "./itemDataService.ts";
import { getVendorManifestByTypeName } from "./serversideVendorsService.ts";

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

void test("market prices cover the Banshee Threnodia suit skin", async () => {
    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        PremiumCredits: 165,
        PremiumCreditsFree: 0
    });

    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Market,
                StoreItem: "/Lotus/StoreItems/Upgrades/Skins/Decree/BansheeDeluxeBSkin",
                Quantity: 1,
                UsePremium: true,
                ExpectedPrice: 165
            },
            buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
        },
        inventory
    );

    assert.deepEqual(
        response.InventoryChanges.WeaponSkins?.map(item => item.ItemType),
        ["/Lotus/Upgrades/Skins/Decree/BansheeDeluxeBSkin"]
    );
    assert.equal(response.InventoryChanges.PremiumCredits, -165);
    assert.equal(inventory.PremiumCredits, 0);
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

void test("market booster packages are not discounted by an active booster", async () => {
    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        PremiumCredits: 200,
        PremiumCreditsFree: 0,
        Boosters: [{ ItemType: "/Lotus/Types/Boosters/ResourceAmountBooster", ExpiryDate: 9999999999 }]
    });

    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Market,
                StoreItem: "/Lotus/Types/StoreItems/Boosters/ResourceAmount30DayStoreItem",
                Quantity: 1,
                UsePremium: true,
                ExpectedPrice: 200
            },
            buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
        },
        inventory
    );

    assert.equal(response.InventoryChanges.PremiumCredits, -200);
    assert.equal(inventory.PremiumCredits, 0);
});

void test("RoadToTau vendor exposes the extracted manifest and accepts event-resource purchases", async () => {
    const vendor = getVendor(ROAD_TO_TAU_VENDOR);
    assert.ok(vendor);
    assert.equal(vendor.isDynamic, true);
    assert.equal(vendor.requiredGoalTag, "RoadToTauEvent");
    assert.equal(vendor.items.length, 50);

    const manifest = getVendorManifestByTypeName(ROAD_TO_TAU_VENDOR, true);
    assert.ok(manifest);
    assert.equal(manifest.VendorInfo.RequiredGoalTag, "RoadToTauEvent");
    assert.equal(manifest.VendorInfo.ItemManifest.length, 50);

    const weaponOffer = manifest.VendorInfo.ItemManifest.find(
        offer => offer.StoreItem == "/Lotus/StoreItems/Weapons/Sentients/SentOctaMiniGun/SentOctaMiniGun"
    );
    assert.ok(weaponOffer);
    assert.equal(weaponOffer.PurchaseQuantityLimit, 1);
    assert.equal(weaponOffer.AllowMultipurchase, false);
    assert.deepEqual(weaponOffer.ItemPrices, [
        {
            ItemType: ROAD_TO_TAU_CURRENCY,
            ItemCount: 150,
            ProductCategory: "MiscItems"
        }
    ]);

    const sigilOffer = manifest.VendorInfo.ItemManifest.find(
        offer => offer.StoreItem == "/Lotus/StoreItems/Upgrades/Skins/Sigils/ClanSigilBasicAdd"
    );
    assert.ok(sigilOffer);
    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        PremiumCredits: 0,
        PremiumCreditsFree: 0,
        MiscItems: [{ ItemType: ROAD_TO_TAU_CURRENCY, ItemCount: 50 }]
    });

    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Vendor,
                SourceId: manifest.VendorInfo._id.$oid,
                StoreItem: sigilOffer.StoreItem,
                Quantity: 1,
                UsePremium: false
            },
            buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
        },
        inventory
    );

    assert.equal(response.InventoryChanges.MiscItems![0].ItemType, ROAD_TO_TAU_CURRENCY);
    assert.equal(response.InventoryChanges.MiscItems![0].ItemCount, -50);
    assert.equal(inventory.MiscItems.some(item => item.ItemType == ROAD_TO_TAU_CURRENCY), false);
    assert.equal(response.InventoryChanges.WeaponSkins!.length, 1);
    assert.equal(
        response.InventoryChanges.WeaponSkins![0].ItemType,
        "/Lotus/Upgrades/Skins/Sigils/ClanSigilBasicAdd"
    );
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

void test("syndicate augment-two cards are added as raw upgrades", async () => {
    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        Affiliations: [
            {
                Tag: "SteelMeridianSyndicate",
                Standing: 0,
                FreeFavorsEarned: [2],
                FreeFavorsUsed: []
            }
        ]
    });

    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.SyndicateFavor,
                StoreItem: "/Lotus/StoreItems/Powersuits/Frost/IceShieldAugmentTwoCard",
                Quantity: 1,
                UsePremium: false,
                ExpectedPrice: 0,
                SyndicateTag: "SteelMeridianSyndicate",
                UseFreeFavor: true
            },
            buildLabel: "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg"
        },
        inventory
    );

    assert.deepEqual(response.InventoryChanges.RawUpgrades, [
        {
            ItemType: "/Lotus/Powersuits/Frost/IceShieldAugmentTwoCard",
            ItemCount: 1
        }
    ]);
    assert.equal(response.InventoryChanges.Suits, undefined);
    assert.equal(response.InventoryChanges.SuitBin, undefined);
    assert.deepEqual(response.FreeFavorsUsed, [{ Tag: "SteelMeridianSyndicate", Title: 2 }]);
});
