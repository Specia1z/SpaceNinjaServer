import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Account } from "../../models/loginModel.ts";
import { config } from "../../services/configService.ts";
import { deleteAdminAccountController } from "./deleteAccountController.ts";

void test("admin account deletion rejects invalid, self, and administrator targets", async t => {
    const administratorId = new Types.ObjectId();
    const otherAdministratorId = new Types.ObjectId();
    const administrator = { _id: administratorId, DisplayName: "DeleteAdmin", Nonce: 123 };
    const otherAdministrator = { _id: otherAdministratorId, DisplayName: "OtherAdmin", Nonce: 456 };
    const previousAdministrators = config.administratorNames;
    config.administratorNames = [administrator.DisplayName, otherAdministrator.DisplayName];
    t.after(() => {
        config.administratorNames = previousAdministrators;
    });

    t.mock.method(Account, "findById", (id: unknown) =>
        Promise.resolve(String(id) == administratorId.toString() ? administrator : otherAdministrator)
    );

    const call = async (accountId: string): Promise<number> => {
        let status = 200;
        const res = {
            status(code: number) {
                status = code;
                return this;
            },
            send() {
                return this;
            },
            json() {
                return this;
            }
        } as unknown as Response;
        await deleteAdminAccountController(
            {
                query: { accountId: administratorId.toString(), nonce: "123" },
                body: { accountId }
            } as unknown as Request,
            res,
            () => {}
        );
        return status;
    };

    assert.equal(await call("invalid-account-id"), 400);
    assert.equal(await call(administratorId.toString()), 400);
    assert.equal(await call(otherAdministratorId.toString()), 403);
});
