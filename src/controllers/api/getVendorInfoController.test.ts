import assert from "node:assert/strict";
import { test } from "node:test";
import { ROAD_TO_TAU_VENDOR } from "../../constants/roadToTauVendor.ts";
import { getVendorInfoController } from "./getVendorInfoController.ts";

void test("getVendorInfo.php returns the RoadToTau event vendor", async () => {
    let payload:
        | {
              VendorInfo: {
                  TypeName: string;
                  RequiredGoalTag?: string;
                  ItemManifest: { StoreItem: string }[];
              };
          }
        | undefined;
    const handler = getVendorInfoController as unknown as (
        request: { query: Record<string, string> },
        response: { json: (value: typeof payload) => void }
    ) => Promise<void>;

    await handler(
        { query: { vendor: ROAD_TO_TAU_VENDOR } },
        {
            json: value => {
                payload = value;
            }
        }
    );

    assert.ok(payload);
    assert.equal(payload.VendorInfo.TypeName, ROAD_TO_TAU_VENDOR);
    assert.equal(payload.VendorInfo.RequiredGoalTag, "RoadToTauEvent");
    assert.equal(payload.VendorInfo.ItemManifest.length, 50);
    assert.equal(
        payload.VendorInfo.ItemManifest.some(
            item => item.StoreItem == "/Lotus/StoreItems/Upgrades/Skins/Sigils/ClanSigilBasicAdd"
        ),
        true
    );
});
