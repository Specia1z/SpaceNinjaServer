import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "./configService.ts";
import { hasPermission } from "./loginService.ts";

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
