import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Account } from "../models/loginModel.ts";
import { CurrencyGrantStat } from "../models/currencyGrantStatModel.ts";
import { getCurrencyGrantDay, getCurrencyGrantStats, recordCurrencyGrant } from "./currencyGrantStatService.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}currency-grant-stat-test`);
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("currency grant stats aggregate by account and source", async () => {
    await Promise.all([Account.deleteMany({}), CurrencyGrantStat.deleteMany({})]);
    const first = await new Account({
        email: "grant-stats-first@example.com",
        password: "password",
        DisplayName: "First Account",
        Nonce: 1,
        LastLogin: new Date()
    }).save();
    const second = await new Account({
        email: "grant-stats-second@example.com",
        password: "password",
        DisplayName: "Second Account",
        Nonce: 2,
        LastLogin: new Date()
    }).save();

    await recordCurrencyGrant(first._id, { platinum: 5, source: "mission-platinum" });
    await recordCurrencyGrant(first._id, { regalAya: 1, source: "mission-aya" });
    await recordCurrencyGrant(first._id, { platinum: 2, source: "mission-platinum" });
    await recordCurrencyGrant(second._id, { platinum: 3, source: "admin" });

    const stats = await getCurrencyGrantStats(getCurrencyGrantDay());
    assert.deepEqual(stats.totals, { platinum: 10, regalAya: 1 });
    assert.deepEqual(
        stats.accounts.map(account => ({
            name: account.displayName,
            platinum: account.platinum,
            regalAya: account.regalAya
        })),
        [
            { name: "First Account", platinum: 7, regalAya: 1 },
            { name: "Second Account", platinum: 3, regalAya: 0 }
        ]
    );
    assert.deepEqual(
        stats.sources.map(source => ({ source: source.source, platinum: source.platinum, regalAya: source.regalAya })),
        [
            { source: "mission-platinum", platinum: 7, regalAya: 0 },
            { source: "admin", platinum: 3, regalAya: 0 },
            { source: "mission-aya", platinum: 0, regalAya: 1 }
        ]
    );
});

void test("currency grant stats reject malformed dates before querying", async () => {
    await assert.rejects(() => getCurrencyGrantStats("2026-02-30"), /ISO date/);
});
