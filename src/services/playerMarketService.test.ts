import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { Account } from "../models/loginModel.ts";
import { PlayerMarketState } from "../models/playerMarketModel.ts";
import { config } from "./configService.ts";
import { getPlayerMarketSummary, tradePlayerMarket } from "./playerMarketService.ts";

let mongod: MongoMemoryServer;
const previousMarket = config.playerMarket;
const itemType = "/Lotus/Types/Items/MiscItems/Ferrite";
const modType = "/Lotus/Types/Upgrades/Mods/Warframe/WarframeMeleeDamageMod";
const nonTradableCosmeticType = "/Lotus/Upgrades/Skins/YinYang/EquinoxPrimeHelmet";

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}player-market-test`);
    await PlayerMarketState.collection.createIndex({ itemType: 1 }, { name: "itemType_1", unique: true });
    config.playerMarket = {
        enabled: true,
        buyEnabled: true,
        sellEnabled: true,
        accountDailyPlatinumCap: 1_000,
        accountDailyTransactionLimit: 20,
        accountDailyQuantityCap: 1_000,
        globalDailyMintCap: 10_000,
        globalDailyTransactionLimit: 100,
        globalDailyQuantityCap: 10_000,
        priceSpreadPercent: 10,
        priceChangeLimitPercent: 5,
        minimumAccountAgeHours: 0,
        excludedItemPatterns: [],
        itemOverrides: {}
    };
});

after(async () => {
    config.playerMarket = previousMarket;
    await mongoose.disconnect();
    await mongod.stop();
});

void test("system market moves real stack inventory and settles platinum", async () => {
    const seller = await new Account({ email: "market-seller@example.com", password: "password", DisplayName: "Seller" }).save();
    const buyer = await new Account({ email: "market-buyer@example.com", password: "password", DisplayName: "Buyer" }).save();
    await new Inventory({ accountOwnerId: seller._id, PremiumCredits: 0, PremiumCreditsFree: 0, MiscItems: [{ ItemType: itemType, ItemCount: 100 }] }).save();
    await new Inventory({ accountOwnerId: buyer._id, PremiumCredits: 100, PremiumCreditsFree: 100, MiscItems: [] }).save();

    const sold = await tradePlayerMarket(seller, "sell", {
        inventoryField: "MiscItems",
        itemType,
        mode: "stack",
        quantity: 10,
        requestId: "sell-ferrite-000001"
    });
    assert.equal(sold.ledger.status, "completed");
    assert.equal((await Inventory.findOne({ accountOwnerId: seller._id }))?.MiscItems[0]?.ItemCount, 90);
    assert.equal((await Inventory.findOne({ accountOwnerId: seller._id }))?.PremiumCredits, 10);

    const summary = await getPlayerMarketSummary(buyer._id);
    assert.equal(summary.items.length, 1);
    assert.equal(summary.items[0].systemStock, 10);
    assert.equal(summary.items[0].displayName.length > 0, true);

    const bought = await tradePlayerMarket(buyer, "buy", {
        inventoryField: "MiscItems",
        itemType,
        mode: "stack",
        quantity: 4,
        requestId: "buy-ferrite-000001"
    });
    assert.equal(bought.platinum, 92);
    assert.equal((await Inventory.findOne({ accountOwnerId: buyer._id }))?.MiscItems[0]?.ItemCount, 4);
    assert.equal((await Inventory.findOne({ MarketSystem: true }))?.MiscItems[0]?.ItemCount, 6);

    await Inventory.updateOne(
        { accountOwnerId: seller._id },
        {
            $push: {
                Upgrades: {
                    $each: [
                    { ItemType: modType, UpgradeFingerprint: "MOD-FINGERPRINT-1" },
                    { ItemType: nonTradableCosmeticType, UpgradeFingerprint: "COSMETIC-FINGERPRINT-1" }
                    ]
                }
            }
        }
    );
    await tradePlayerMarket(seller, "sell", {
        inventoryField: "Upgrades",
        itemType: modType,
        mode: "instance",
        quantity: 1,
        requestId: "sell-mod-00000001"
    });
    assert.equal((await Inventory.findOne({ accountOwnerId: seller._id }))?.Upgrades.length, 1);
    const sellerSummary = await getPlayerMarketSummary(seller._id);
    assert.equal(sellerSummary.inventory.some(item => item.itemType == nonTradableCosmeticType), false);
    await tradePlayerMarket(buyer, "buy", {
        inventoryField: "Upgrades",
        itemType: modType,
        mode: "instance",
        quantity: 1,
        requestId: "buy-mod-00000001"
    });
    assert.equal((await Inventory.findOne({ accountOwnerId: buyer._id }))?.Upgrades[0]?.UpgradeFingerprint, "MOD-FINGERPRINT-1");
});
