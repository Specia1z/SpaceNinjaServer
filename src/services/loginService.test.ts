import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "./configService.ts";
import { hasPermission, isAdministrator } from "./loginService.ts";

void test("administrators receive every WebUI permission", () => {
    const previousAdministrators = config.administratorNames;
    try {
        config.administratorNames = ["administrator"];
        const account = { DisplayName: "administrator" };
        assert.equal(isAdministrator(account), true);
        assert.equal(hasPermission(account, "toggleCheat.infinitePlatinum"), true);
        assert.equal(hasPermission(account, "addPlatinum"), true);
    } finally {
        config.administratorNames = previousAdministrators;
    }
});

void test("missing non-admin permissions fail closed", () => {
    const previousWebui = config.webui;
    try {
        config.webui = undefined;
        assert.equal(hasPermission({ DisplayName: "ordinary-player" }, "addPlatinum"), false);

        config.webui = { nonAdminPermissions: { addPlatinum: true } };
        assert.equal(hasPermission({ DisplayName: "ordinary-player" }, "addPlatinum"), true);
    } finally {
        config.webui = previousWebui;
    }
});
