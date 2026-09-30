import type { RequestHandler } from "express";
import { Account } from "../../models/loginModel.ts";
import { handleNonceInvalidation } from "../../services/wsService.ts";
import { markPresenceOffline } from "../../services/presenceService.ts";

export const logoutController: RequestHandler = async (req, res) => {
    if (!req.query.accountId) {
        throw new Error("Request is missing accountId parameter");
    }
    const nonce: number = parseInt(req.query.nonce as string);
    if (!nonce) {
        throw new Error("Request is missing nonce parameter");
    }

    const stat = await Account.updateOne(
        {
            _id: req.query.accountId,
            Nonce: nonce
        },
        {
            Nonce: 0,
            $unset: { Dropped: 1 }
        }
    );
    if (stat.modifiedCount) {
        handleNonceInvalidation(req.query.accountId as string);
        const account = await Account.findById(req.query.accountId, "DisplayName");
        if (account) await markPresenceOffline(account._id, account.DisplayName, "logout");
    }

    res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Length": 1
    });
    res.end("1");
};
