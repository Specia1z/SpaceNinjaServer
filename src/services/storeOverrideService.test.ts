import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { StoreOverride, type IStoreOverride } from "../models/storeOverrideModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { ePurchaseSource } from "../types/purchaseTypes.ts";
import type { IWorldState } from "../types/worldStateTypes.ts";
import { getPrice } from "./itemDataService.ts";
import { handlePurchase } from "./purchaseService.ts";
import {
    applyStoreOverrides,
    deleteStoreOverride,
    initializeStoreOverrides,
    isStoreItemPurchasable,
    saveStoreOverride
} from "./storeOverrideService.ts";

const buildLabel = "2026.09.30.14.45/Rc-z7J92eRikCYiXffFybg";
const typeName = "/Lotus/Upgrades/Skins/Scarves/SWRepalaScarf";
const storeItem = "/Lotus/StoreItems/Upgrades/Skins/Scarves/SWRepalaScarf";
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
    assert.equal(state.FlashSales[0].TypeName, typeName);
    assert.equal(state.FlashSales[0].ShowInMarket, true);
    assert.equal(state.FlashSales[0].Discount, 0);
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

void test("hidden Repala can be purchased, and clearing category and price removes saved values", async () => {
    await saveStoreOverride(override({ Listed: false, Purchasable: true, CategoryName: "TENNOGEN", PremiumPrice: 75 }));
    const saved = await saveStoreOverride(override({ Listed: false, Purchasable: true }));
    assert.equal(saved.CategoryName, undefined);
    assert.equal(saved.PremiumPrice, undefined);
    assert.equal(isStoreItemPurchasable(typeName), true);

    const state = worldState();
    state.InGameMarket.LandingPage.Categories[1].Items = [storeItem];
    applyStoreOverrides(state, buildLabel);
    assert.deepEqual(state.InGameMarket.LandingPage.Categories[1].Items, []);
    assert.equal(state.FlashSales[0].HideFromMarket, true);

    const inventory = new Inventory({ accountOwnerId: "000000000000000000000001", PremiumCredits: 200 });
    const response = await handlePurchase(
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
    );
    assert.equal(response.InventoryChanges.PremiumCredits, -105);
    assert.equal(inventory.PremiumCredits, 95);
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

void test("absolute prices do not emit a competing zero-percent discount", async () => {
    await saveStoreOverride(override({ PremiumPrice: 75, Purchasable: true }));
    const state = worldState();
    applyStoreOverrides(state, buildLabel);

    assert.equal(state.FlashSales[0].Discount, undefined);
    assert.equal(state.FlashSales[0].PremiumOverride, 75);
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
        StartDate: state.FlashSales[0].StartDate,
        EndDate: state.FlashSales[0].EndDate,
        ProductExpiryOverride: state.FlashSales[0].ProductExpiryOverride
    });
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
