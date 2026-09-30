import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { Account } from "../../models/loginModel.ts";

export const getRegisteredLosersController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (isAdministrator(account)) {
        const accounts = await Account.find({}, "id DisplayName Banned");
        res.json(
            accounts.map(target => ({
                id: target.id,
                DisplayName: target.DisplayName,
                Banned: target.Banned ?? false,
                IsAdministrator: isAdministrator(target)
            }))
        );
    } else {
        res.status(401).end();
    }
};
