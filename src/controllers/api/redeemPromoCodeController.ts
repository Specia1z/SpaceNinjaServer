import { getJSONfromString } from "../../helpers/stringHelpers.ts";
import type { RequestHandler } from "express";
import glyphCodes from "../../../static/fixed_responses/glyphsCodes.json" with { type: "json" };
import { getAccountIdForRequest } from "../../services/loginService.ts";
import { addItem, addItems, getInventory } from "../../services/inventoryService.ts";
import { redeemCode } from "../../services/redeemCodeService.ts";
import { broadcastInventoryUpdate } from "../../services/wsService.ts";
import { logger } from "../../utils/logger.ts";

// Codes the game client may submit come from two disjoint sources:
//   1. the hardcoded promotional/glyph codes shipped in static/fixed_responses
//   2. codes an administrator created through the WebUI's redeem-code manager
// Both are accepted here because the game only ever posts to this endpoint; the WebUI has its own route.
export const redeemPromoCodeController: RequestHandler = async (req, res) => {
    const body = getJSONfromString<IRedeemPromoCodeRequest>(String(req.body));
    if (typeof body.codeId != "string" || !body.codeId) {
        res.status(400).send("INVALID_CODE").end();
        return;
    }
    const accountId = await getAccountIdForRequest(req);

    // Look up the glyph code case-insensitively: players type these by hand and the client does not
    // normalise them, so "kavats schroedinger" should still work.
    const glyphCode = Object.keys(glyphCodes).find(x => x.toUpperCase() == body.codeId.trim().toUpperCase());
    if (glyphCode !== undefined) {
        await redeemGlyphCode(glyphCode, accountId, req, res);
        return;
    }

    const result = await redeemCode(body.codeId, accountId);
    if (!result.ok) {
        res.status(400).send(result.reason).end();
        return;
    }

    // A custom code can grant any item in the game, so the response cannot use the FlavourItems-only shape
    // that glyph codes rely on. It instead reports the acquisition as InventoryChanges, which the client
    // handles generically for every inventory bin.
    const inventory = await getInventory(accountId, undefined);
    const inventoryChanges = await addItems(inventory, result.rewards, {});
    if (inventory.modifiedPaths().length != 0) {
        await inventory.save();
        broadcastInventoryUpdate(req);
    }

    // FlavourItems are the one bin where the change shape and the inventory shape differ: the inventory
    // stores { ItemType } objects, but this endpoint's client-side handler wants plain unique names, which
    // is what the glyph path above has always sent. Sending objects leaves the client stuck on its
    // "please wait" modal even though the items were granted server-side.
    const response: Record<string, unknown> = { ...inventoryChanges };
    if (inventoryChanges.FlavourItems) {
        response.FlavourItems = inventoryChanges.FlavourItems.map(item => item.ItemType);
    }
    logger.debug("redeemPromoCode response", response);
    res.json(response);
};

const redeemGlyphCode = async (
    glyphCode: string,
    accountId: string,
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1]
): Promise<void> => {
    const inventory = await getInventory(accountId, "FlavourItems");
    const acquiredGlyphs: string[] = [];
    for (const glyph of (glyphCodes as Record<string, string[]>)[glyphCode]) {
        if (!inventory.FlavourItems.find(x => x.ItemType == glyph)) {
            acquiredGlyphs.push(glyph);
            await addItem(inventory, glyph);
        }
    }
    if (acquiredGlyphs.length == 0) {
        res.status(400).send("USED_CODE").end();
        return;
    }
    await inventory.save();
    broadcastInventoryUpdate(req);
    res.json({
        FlavourItems: acquiredGlyphs
    });
};

interface IRedeemPromoCodeRequest {
    codeId: string;
}
