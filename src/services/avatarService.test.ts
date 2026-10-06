import assert from "node:assert/strict";
import { test } from "node:test";
import { getAvatarIcon } from "./avatarService.ts";

void test("unknown avatar image types use the default Lotus icon", () => {
    assert.equal(
        getAvatarIcon("/Lotus/Types/StoreItems/AvatarImages/RemovedAvatar"),
        "/Lotus/Interface/Icons/Player/LotusSymbol.png"
    );
    assert.equal(getAvatarIcon(undefined), "/Lotus/Interface/Icons/Player/LotusSymbol.png");
});
