import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { StoreOverride, type IStoreOverride } from "../models/storeOverrideModel.ts";
import { StorePrice } from "../models/storePriceModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { ePurchaseSource } from "../types/purchaseTypes.ts";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { getPrice, getUndiscountedPrice } from "./itemDataService.ts";
import {
    deleteSupplementalStorePrice,
    listOfficialStorePricePage,
    saveSupplementalStorePrice,
    syncOfficialStorePrices
} from "./officialStorePriceService.ts";
import { handleBundleAcquisition, handlePurchase } from "./purchaseService.ts";
import { deleteStoreBundle, listStoreBundles, saveStoreBundle } from "./storeBundleService.ts";
import {
    applyStoreOverrides,
    deleteStoreOverride,
    getStoreItemGiftBonus,
    getStoreItemRules,
    getStoreItemBogoBonusQuantity,
    initializeStoreOverrides,
    isStoreItemGiftable,
    isStoreItemPurchasable,
    listStoreOverridePage,
    saveStoreOverride,
    syncStoreOverridePrices
} from "./storeOverrideService.ts";

const buildLabel = "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg";
const typeName = "/Lotus/Upgrades/Skins/Scarves/SWRepalaScarf";
const storeItem = "/Lotus/StoreItems/Upgrades/Skins/Scarves/SWRepalaScarf";
const bonusBundle = "/Lotus/Types/StoreItems/Packages/WarframeBundles/CitrineItemsBundle";
const bonusReward = "/Lotus/StoreItems/Types/Items/ShipDecos/LisetPropStyanaxSpearShieldDeco";
const kuvaItem = "/Lotus/Types/Items/MiscItems/Kuva";
const kuvaStoreItem = "/Lotus/StoreItems/Types/Items/MiscItems/Kuva";
let mongod: MongoMemoryServer;

const worldState = (): IWorldState =>
    ({
        FlashSales: [],
        InGameMarket: {
            LandingPage: {
                Categories: [
                    { CategoryName: "NEW", Name: "new", Icon: "new", Items: [] },
                    { CategoryName: "TENNOGEN", Name: "tennogen", Icon: "tennogen", Items: [] },
                    { CategoryName: "SALE", Name: "sale", Icon: "sale", Items: [] }
                ]
            }
        }
    }) as unknown as IWorldState;

const override = (changes: Partial<IStoreOverride> = {}): IStoreOverride => ({
    TypeName: typeName,
    Enabled: true,
    Listed: true,
    UpdatedBy: "test",
    ...changes
});

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}store-override-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("visible Repala appears in TennoGen but purchase can be blocked independently", async () => {
    await saveStoreOverride(override({ Purchasable: false, CategoryName: "TENNOGEN" }));
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.deepEqual(state.InGameMarket.LandingPage.Categories[0].Items, []);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[1].Items, [storeItem]);
    assert.deepEqual(state.FlashSales, []);
    assert.equal(isStoreItemPurchasable(typeName), false);

    const inventory = new Inventory({ accountOwnerId: "000000000000000000000001", PremiumCredits: 200 });
    await assert.rejects(
        handlePurchase(
            {
                PurchaseParams: { Source: ePurchaseSource.Market, StoreItem: storeItem, Quantity: 1, UsePremium: true },
                buildLabel
            },
            inventory
        ),
        /not currently purchasable/
    );
    assert.equal(inventory.PremiumCredits, 200);
});

void test("hidden Repala is removed from every category and cannot be purchased", async () => {
    await saveStoreOverride(override({ Listed: false, Purchasable: true, CategoryName: "TENNOGEN", PremiumPrice: 75 }));
    const saved = await saveStoreOverride(override({ Listed: false, Purchasable: true }));
    assert.equal(saved.CategoryName, undefined);
    assert.equal(saved.PremiumPrice, undefined);
    assert.equal(isStoreItemPurchasable(typeName), false);
    assert.equal(isStoreItemPurchasable(storeItem), false);

    const state = worldState();
    state.InGameMarket.LandingPage.Categories.forEach(category => {
        category.Items = [storeItem];
    });
    applyStoreOverrides(state, buildLabel);
    assert.deepEqual(
        state.InGameMarket.LandingPage.Categories.map(category => category.Items),
        [[], [], []]
    );
    assert.equal(state.FlashSales[0].HideFromMarket, true);

    const inventory = new Inventory({ accountOwnerId: "000000000000000000000001", PremiumCredits: 200 });
    await assert.rejects(
        handlePurchase(
            {
                PurchaseParams: {
                    Source: ePurchaseSource.Market,
                    StoreItem: storeItem,
                    Quantity: 1,
                    UsePremium: true,
                    ExpectedPrice: 105
                },
                buildLabel
            },
            inventory
        ),
        /not currently purchasable/
    );
    assert.equal(inventory.PremiumCredits, 200);
});

void test("discounted Repala uses the client's truncated unit price when purchasing", async () => {
    await saveStoreOverride(override({ DiscountPercent: 5, Purchasable: true }));
    assert.equal(getPrice(storeItem, 1, 0, true, buildLabel), 99);
    assert.equal(getPrice(storeItem, 2, 0, true, buildLabel), 198);

    const inventory = new Inventory({ accountOwnerId: "000000000000000000000001", PremiumCredits: 200 });
    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Market,
                StoreItem: storeItem,
                Quantity: 1,
                UsePremium: true,
                ExpectedPrice: 99
            },
            buildLabel
        },
        inventory
    );
    assert.equal(response.InventoryChanges.PremiumCredits, -99);
    assert.equal(inventory.PremiumCredits, 101);

    await saveStoreOverride(override({ DiscountPercent: 10, Purchasable: true }));
    assert.equal(getPrice(storeItem, 1, 0, true, buildLabel), 94);
});

void test("category-only overrides do not mark items as limited-time sales", async () => {
    await saveStoreOverride(override({ CategoryName: "POPULAR" }));
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.deepEqual(state.FlashSales, []);
    await deleteStoreOverride(typeName);
});

void test("category and promotion schedules are independent", async () => {
    const now = Date.now();
    await saveStoreOverride(
        override({
            CategoryName: "SALE",
            CategoryStartDate: new Date(now - 60_000),
            CategoryEndDate: new Date(now + 60_000),
            DiscountPercent: 5,
            StartDate: new Date(now + 60_000),
            EndDate: new Date(now + 120_000)
        })
    );

    const categoryOnlyState = worldState();
    applyStoreOverrides(categoryOnlyState, buildLabel);
    assert.deepEqual(categoryOnlyState.InGameMarket.LandingPage.Categories[2].Items, [storeItem]);
    assert.deepEqual(categoryOnlyState.FlashSales, []);
    assert.equal(getPrice(storeItem, 1, 0, true, buildLabel), 105);

    await saveStoreOverride(
        override({
            CategoryName: "SALE",
            CategoryStartDate: new Date(now + 60_000),
            CategoryEndDate: new Date(now + 120_000),
            DiscountPercent: 5,
            StartDate: new Date(now - 60_000),
            EndDate: new Date(now + 60_000)
        })
    );

    const promotionOnlyState = worldState();
    applyStoreOverrides(promotionOnlyState, buildLabel);
    assert.deepEqual(promotionOnlyState.InGameMarket.LandingPage.Categories[2].Items, []);
    assert.equal(promotionOnlyState.FlashSales[0].Discount, 5);
    await deleteStoreOverride(typeName);
});

void test("promotion and limited-sale schedules emit separate client dates", async () => {
    const now = Date.now();
    const promotionEnd = new Date(now + 60_000);
    const productExpiry = new Date(now + 30 * 24 * 60 * 60_000);
    await saveStoreOverride(
        override({
            DiscountPercent: 10,
            StartDate: new Date(now - 60_000),
            EndDate: promotionEnd,
            ProductExpiryDate: productExpiry
        })
    );

    const activeState = worldState();
    applyStoreOverrides(activeState, buildLabel);
    assert.equal(activeState.FlashSales[0].Discount, 10);
    assert.notDeepEqual(activeState.FlashSales[0].EndDate, activeState.FlashSales[0].ProductExpiryOverride);

    await saveStoreOverride(
        override({
            DiscountPercent: 10,
            StartDate: new Date(now - 120_000),
            EndDate: new Date(now - 60_000),
            ProductExpiryDate: productExpiry
        })
    );
    const limitedSaleState = worldState();
    applyStoreOverrides(limitedSaleState, buildLabel);
    assert.equal(limitedSaleState.FlashSales[0].Discount, undefined);
    assert.equal("EndDate" in limitedSaleState.FlashSales[0], true);
    assert.deepEqual(limitedSaleState.FlashSales[0].EndDate, limitedSaleState.FlashSales[0].ProductExpiryOverride);
    assert.equal("ProductExpiryOverride" in limitedSaleState.FlashSales[0], true);
    assert.equal(getPrice(storeItem, 1, 0, true, buildLabel), 105);
    await deleteStoreOverride(typeName);
});

void test("absolute prices do not emit a competing zero-percent discount", async () => {
    await saveStoreOverride(override({ PremiumPrice: 75, Purchasable: true }));
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.deepEqual(state.InGameMarket.LandingPage.Categories[0].Items, [storeItem]);
    assert.equal(state.FlashSales[0].Discount, undefined);
    assert.equal(state.FlashSales[0].PremiumOverride, 75);
    assert.equal("StartDate" in state.FlashSales[0], true);
    assert.equal("EndDate" in state.FlashSales[0], true);
});

void test("limited-only overrides reuse the original store price", async () => {
    await saveStoreOverride(override({ ProductExpiryDate: new Date(Date.now() + 60_000) }));
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.equal(state.FlashSales[0].Discount, undefined);
    assert.equal(state.FlashSales[0].PremiumOverride, 105);
    assert.equal(state.FlashSales[0].RegularOverride, undefined);
    assert.equal(getPrice(storeItem, 1, 0, true, buildLabel), 105);
    await deleteStoreOverride(typeName);
});

void test("expired limited products are hidden and cannot be purchased or gifted", async () => {
    await saveStoreOverride(
        override({
            CategoryName: "SALE",
            ProductExpiryDate: new Date(Date.now() - 60_000),
            Purchasable: true,
            Giftable: true
        })
    );
    const state = worldState();
    state.InGameMarket.LandingPage.Categories[0].Items = [storeItem];
    state.InGameMarket.LandingPage.Categories[2].Items = [storeItem];
    applyStoreOverrides(state, buildLabel);

    assert.deepEqual(state.InGameMarket.LandingPage.Categories[0].Items, []);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[2].Items, []);
    assert.deepEqual(state.FlashSales, []);
    assert.equal(isStoreItemPurchasable(typeName), false);
    assert.equal(isStoreItemGiftable(typeName), false);
    await deleteStoreOverride(typeName);
});

void test("gift bonus replacement is shared between tunables and gifting lookup", async () => {
    try {
        await saveStoreOverride(override({ TypeName: bonusBundle, GiftingBonus: bonusReward }));
        assert.equal(getStoreItemGiftBonus(bonusBundle), bonusReward);
        const rules = JSON.parse(getStoreItemRules()) as Record<string, { giftBonus?: string }>;
        assert.equal(rules[bonusBundle].giftBonus, bonusReward);
        await saveStoreOverride(
            override({
                TypeName: bonusBundle,
                GiftingBonus: bonusReward,
                ProductExpiryDate: new Date(Date.now() - 60_000)
            })
        );
        assert.equal(getStoreItemGiftBonus(bonusBundle), undefined);
        const expiredRules = JSON.parse(getStoreItemRules()) as Record<string, { giftBonus?: string }>;
        assert.equal(expiredRules[bonusBundle], undefined);
    } finally {
        await deleteStoreOverride(bonusBundle);
    }
});

void test("ordinary market items can grant a new gift bonus, including themselves", async () => {
    try {
        await saveStoreOverride(override({ TypeName: kuvaItem, GiftingBonus: kuvaItem }));
        assert.equal(getStoreItemGiftBonus(kuvaStoreItem), kuvaStoreItem);
        const rules = JSON.parse(getStoreItemRules()) as Record<string, { giftBonus?: string }>;
        assert.equal(rules[kuvaStoreItem].giftBonus, kuvaStoreItem);
    } finally {
        await deleteStoreOverride(kuvaItem);
    }
});

void test("expired promotions keep the product listed at its original price", async () => {
    await saveStoreOverride(
        override({
            CategoryName: "SALE",
            DiscountPercent: 10,
            StartDate: new Date(Date.now() - 120_000),
            EndDate: new Date(Date.now() - 60_000)
        })
    );
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.deepEqual(state.InGameMarket.LandingPage.Categories[2].Items, [storeItem]);
    assert.deepEqual(state.FlashSales, []);
    assert.equal(getPrice(storeItem, 1, 0, true, buildLabel), 105);
    await deleteStoreOverride(typeName);
});

void test("full official price sync updates every resolvable override and preserves other fields", async () => {
    const bansheeTypeName = "/Lotus/Types/StoreItems/Packages/BansheeDeluxe2SkinBundle";
    const discountedTypeName = "/Lotus/Upgrades/Skins/Sentinels/Skins/BansheeDlxSentSkin";
    await deleteStoreOverride(typeName);
    await deleteStoreOverride(bansheeTypeName);
    await deleteStoreOverride(discountedTypeName);
    await saveStoreOverride(
        override({
            PremiumPrice: 1,
            RegularPrice: 2,
            CategoryName: "SALE"
        })
    );
    await saveStoreOverride(
        override({
            TypeName: bansheeTypeName,
            PremiumPrice: 1,
            CategoryName: "NEW"
        })
    );
    await saveStoreOverride(
        override({
            TypeName: discountedTypeName,
            PremiumPrice: 1,
            DiscountPercent: 10
        })
    );

    const result = await syncStoreOverridePrices("price-sync-test", buildLabel);
    const repala = await StoreOverride.findOne({ TypeName: typeName }).lean();
    const banshee = await StoreOverride.findOne({ TypeName: bansheeTypeName }).lean();
    const discounted = await StoreOverride.findOne({ TypeName: discountedTypeName }).lean();

    assert.ok(repala);
    assert.ok(banshee);
    assert.ok(discounted);
    assert.equal(result.updated, 2);
    assert.equal(result.unchanged, 1);
    assert.equal(repala.PremiumPrice, 105);
    assert.equal(repala.RegularPrice, 2);
    assert.equal(repala.CategoryName, "SALE");
    assert.equal(repala.UpdatedBy, "price-sync-test");
    assert.equal(banshee.PremiumPrice, 245);
    assert.equal(banshee.CategoryName, "NEW");
    assert.equal(discounted.PremiumPrice, 1);
    assert.equal(discounted.DiscountPercent, 10);
    await deleteStoreOverride(typeName);
    await deleteStoreOverride(bansheeTypeName);
    await deleteStoreOverride(discountedTypeName);
});

void test("official price sync builds the complete catalogue instead of only custom overrides", async () => {
    const result = await syncOfficialStorePrices();
    const banshee = await StorePrice.findOne({
        TypeName: "/Lotus/Types/StoreItems/Packages/BansheeDeluxe2SkinBundle"
    }).lean();

    assert.ok(result.total > 2_000);
    assert.equal(result.total, await StorePrice.countDocuments());
    assert.ok(banshee);
    assert.equal(banshee.PremiumPrice, 245);
});

void test("supplemental prices survive official sync and update the live cache", async () => {
    const manualTypeName = "/Lotus/Upgrades/Skins/Decree/ManualSupplementalPrice";
    await deleteSupplementalStorePrice(manualTypeName);

    await saveSupplementalStorePrice(manualTypeName, 123, 456);
    assert.equal(getUndiscountedPrice(manualTypeName, 1, 0, true, buildLabel, true), 123);
    assert.equal(getUndiscountedPrice(manualTypeName, 1, 0, false, buildLabel, true), 456);

    await syncOfficialStorePrices();
    const saved = await StorePrice.findOne({ TypeName: manualTypeName }).lean();
    assert.ok(saved);
    assert.equal(saved.Source, "supplemental");

    const page = await listOfficialStorePricePage(1, 10, "ManualSupplementalPrice");
    assert.equal(page.total, 1);
    assert.equal(page.items[0].TypeName, manualTypeName);
    assert.equal(await deleteSupplementalStorePrice(manualTypeName), true);
});

void test("buy-two-get-one applies to paid market quantities without increasing the price", async () => {
    const fusionTypeName = "/Lotus/Upgrades/Mods/FusionBundles/MarketTier1FusionBundle";
    const fusionStoreItem = "/Lotus/StoreItems/Upgrades/Mods/FusionBundles/MarketTier1FusionBundle";
    await deleteStoreOverride(fusionTypeName);

    try {
        await saveStoreOverride(
            override({
                TypeName: fusionTypeName,
                BogoBuy: 2,
                BogoGet: 1,
                Purchasable: true
            })
        );
        assert.equal(getStoreItemBogoBonusQuantity(fusionStoreItem, 1), 0);
        assert.equal(getStoreItemBogoBonusQuantity(fusionStoreItem, 2), 1);

        const inventory = new Inventory({
            accountOwnerId: "000000000000000000000001",
            PremiumCredits: 10,
            PremiumCreditsFree: 0
        });
        const response = await handlePurchase(
            {
                PurchaseParams: {
                    Source: ePurchaseSource.Market,
                    StoreItem: fusionStoreItem,
                    Quantity: 2,
                    UsePremium: true,
                    ExpectedPrice: 10
                },
                buildLabel
            },
            inventory
        );

        assert.equal(response.InventoryChanges.FusionPoints, 300);
        assert.equal(response.InventoryChanges.PremiumCredits, -10);
        assert.equal(inventory.FusionPoints, 300);
        assert.equal(inventory.PremiumCredits, 0);
    } finally {
        await deleteStoreOverride(fusionTypeName);
    }
});

void test("store override pages filter literal paths and clamp requested pages", async () => {
    const typeNames = Array.from(
        { length: 11 },
        (_, index) => `/Lotus/Upgrades/Skins/Decree/PagePagination${String(index).padStart(2, "0")}`
    );
    const literalTypeName = "/Lotus/Upgrades/Skins/Decree/PagePaginationBracket[2]";
    typeNames.push(literalTypeName);
    await Promise.all(typeNames.map(typeName => deleteStoreOverride(typeName)));

    try {
        await StoreOverride.create(typeNames.map(TypeName => override({ TypeName })));

        const filtered = await listStoreOverridePage(1, 10, "PagePaginationBracket[2]");
        assert.equal(filtered.total, 1);
        assert.equal(filtered.page, 1);
        assert.equal(filtered.pageCount, 1);
        assert.equal(filtered.items[0].TypeName, literalTypeName);

        const paged = await listStoreOverridePage(1, 10, "PagePagination");
        assert.equal(paged.total, 12);
        assert.equal(paged.pageCount, 2);
        assert.equal(paged.items.length, 10);

        const clamped = await listStoreOverridePage(99, 10, "PagePagination");
        assert.equal(clamped.page, 2);
        assert.equal(clamped.items.length, 2);
    } finally {
        await Promise.all(typeNames.map(typeName => deleteStoreOverride(typeName)));
    }
});

void test("custom bundle components support inventory-aware pricing and Types StoreItem paths", async () => {
    const bundleTypeName = "/Lotus/Types/StoreItems/Packages/GenericInventoryAwareBundle";
    const componentOne = "/Lotus/StoreItems/Upgrades/Skins/Sentinels/Skins/BansheeDlxSentSkin";
    const componentTwo = "/Lotus/StoreItems/Upgrades/Skins/Decree/BansheeDeluxeBSkin";
    await deleteStoreBundle(bundleTypeName);
    await deleteSupplementalStorePrice(bundleTypeName);
    await syncOfficialStorePrices();
    await saveSupplementalStorePrice(bundleTypeName, 100, undefined);
    await saveStoreBundle(bundleTypeName, [
        { TypeName: componentOne, PurchaseQuantity: 1 },
        { TypeName: componentTwo, PurchaseQuantity: 1 }
    ]);
    const listedBundle = (await listStoreBundles()).find(bundle => bundle.TypeName == bundleTypeName);
    assert.ok(listedBundle);
    assert.equal(listedBundle.Editable, true);
    assert.equal(listedBundle.Components.length, 2);

    const inventory = new Inventory({
        accountOwnerId: "000000000000000000000001",
        PremiumCredits: 80,
        PremiumCreditsFree: 0,
        WeaponSkins: [{ ItemType: "/Lotus/Upgrades/Skins/Sentinels/Skins/BansheeDlxSentSkin" }]
    });
    const response = await handlePurchase(
        {
            PurchaseParams: {
                Source: ePurchaseSource.Market,
                StoreItem: bundleTypeName,
                Quantity: 1,
                UsePremium: true,
                ExpectedPrice: 80
            },
            buildLabel
        },
        inventory
    );

    assert.equal(response.InventoryChanges.PremiumCredits, -80);
    assert.equal(inventory.PremiumCredits, 0);
    await deleteStoreBundle(bundleTypeName);
    await deleteSupplementalStorePrice(bundleTypeName);
    await syncOfficialStorePrices();
});

void test("store bundles preserve AvatarImages type paths when adding flavour items", async () => {
    const bundleTypeName = "/Lotus/Types/StoreItems/Packages/AvatarImagePathBundle";
    const componentTypeName = "/Lotus/StoreItems/AvatarImages/CommunityArtPackVI/AvatarImageCitrineShivecu";
    await deleteStoreBundle(bundleTypeName);

    try {
        await saveStoreBundle(bundleTypeName, [{ TypeName: componentTypeName, PurchaseQuantity: 1 }]);
        const inventory = new Inventory({
            accountOwnerId: "000000000000000000000001",
            PremiumCredits: 0,
            PremiumCreditsFree: 0
        });

        await handleBundleAcquisition(bundleTypeName, inventory, 1, {}, buildLabel);

        assert.equal(
            inventory.FlavourItems.some(
                item =>
                    item.ItemType == "/Lotus/Types/StoreItems/AvatarImages/CommunityArtPackVI/AvatarImageCitrineShivecu"
            ),
            true
        );
    } finally {
        await deleteStoreBundle(bundleTypeName);
    }
});

void test("store overrides expose all supported flash-sale labels and flags", async () => {
    await saveStoreOverride(
        override({
            CategoryName: "SALE",
            DiscountPercent: 25,
            SupporterPack: true,
            BogoBuy: 2,
            BogoGet: 1,
            Featured: true,
            Popular: false,
            BannerIndex: 4
        })
    );
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.deepEqual(state.InGameMarket.LandingPage.Categories[0].Items, []);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[2].Items, [storeItem]);
    assert.deepEqual(state.FlashSales[0], {
        TypeName: typeName,
        ShowInMarket: true,
        HideFromMarket: undefined,
        Discount: 25,
        PremiumOverride: undefined,
        RegularOverride: undefined,
        SupporterPack: true,
        BogoBuy: 2,
        BogoGet: 1,
        Featured: true,
        Popular: false,
        BannerIndex: 4,
        StartDate: { $date: { $numberLong: "0" } },
        EndDate: { $date: { $numberLong: "4102444800000" } }
    });
    assert.equal("StartDate" in state.FlashSales[0], true);
    assert.equal("EndDate" in state.FlashSales[0], true);
    assert.equal("ProductExpiryOverride" in state.FlashSales[0], false);
    await deleteStoreOverride(typeName);
});

void test("older overrides retain their purchase behavior and default newly listed items to New", async () => {
    await deleteStoreOverride(typeName);
    await StoreOverride.create(override({ Listed: false }));
    await initializeStoreOverrides();
    assert.equal(isStoreItemPurchasable(typeName), false);

    await StoreOverride.updateOne({ TypeName: typeName }, { $set: { Listed: true } });
    await initializeStoreOverrides();
    assert.equal(isStoreItemPurchasable(typeName), true);
    const state = worldState();
    applyStoreOverrides(state, buildLabel);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[0].Items, [storeItem]);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[1].Items, []);

    applyStoreOverrides(state, buildLabel);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[0].Items, [storeItem]);
    await deleteStoreOverride(typeName);
});
