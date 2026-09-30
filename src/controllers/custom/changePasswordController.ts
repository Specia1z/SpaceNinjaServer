import type { RequestHandler } from "express";
import { getAccountForRequest, isCorrectPassword } from "../../services/loginService.ts";
import { hashAccountPassword } from "../../services/passwordService.ts";

interface IChangePasswordBody {
    currentPassword?: string;
    newPassword?: string;
}

export const changePasswordController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const body = req.body as IChangePasswordBody;
    if (typeof body.currentPassword != "string" || typeof body.newPassword != "string") {
        res.status(400).send("Missing password fields").end();
        return;
    }
    if (!body.newPassword.length) {
        res.status(400).send("New password is empty").end();
        return;
    }
    if (!(await isCorrectPassword(body.currentPassword, account.password))) {
        res.status(403).send("Wrong password").end();
        return;
    }
    if (body.currentPassword === body.newPassword) {
        res.send("noop").end();
        return;
    }
    account.password = await hashAccountPassword(body.newPassword);
    account.PlayerPasswordVersion = (account.PlayerPasswordVersion ?? 0) + 1;
    await account.save();
    res.end();
};
