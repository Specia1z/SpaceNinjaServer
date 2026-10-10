import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import type { IInventoryClient } from "../../types/inventoryTypes/inventoryTypes.ts";
import { Inventory } from "./inventoryModel.ts";

void test("Kuva Path inventory data serializes with client IDs and Mongo dates", () => {
    const expiry = new Date("2026-10-12T00:00:00.000Z");
    const inventory = new Inventory({
        accountOwnerId: new Types.ObjectId(),
        KuvaKeys: [{ ItemType: "/Lotus/Types/Items/KuvaKeys/KuvaKeyOne", Seed: 123n }],
        KuvaKeysRewards: {
            Expiry: expiry,
            Choices: [{ ItemType: "/Lotus/Types/Items/KuvaKeys/KuvaKeyOne", Seed: 456n, Claimed: false }]
        }
    });

    const response = inventory.toJSON() as unknown as IInventoryClient;
    assert.ok(response.KuvaKeys);
    assert.ok(response.KuvaKeysRewards);
    assert.equal(response.KuvaKeys[0].ItemType, "/Lotus/Types/Items/KuvaKeys/KuvaKeyOne");
    assert.deepEqual(response.KuvaKeys[0].ItemId, { $oid: inventory.KuvaKeys[0]._id.toString() });
    assert.equal(response.KuvaKeys[0].Seed, 123n);
    assert.deepEqual(response.KuvaKeysRewards.Expiry, { $date: { $numberLong: String(expiry.getTime()) } });
    assert.equal(response.KuvaKeysRewards.Choices[0].Seed, 456n);
});
