window.adminDataApi = {
    itemDataStatus: () => $.get("/custom/admin/item-data/status?" + window.authz),
    syncItemData: () =>
        $.post({
            url: "/custom/admin/item-data/sync?" + window.authz,
            contentType: "application/json",
            data: "{}"
        }),
    listStoreOverrides: () => $.get("/custom/admin/store-overrides?" + window.authz),
    saveStoreOverride: payload =>
        $.post({
            url: "/custom/admin/store-overrides?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(payload)
        }),
    deleteStoreOverride: typeName =>
        $.post({
            url: "/custom/admin/store-overrides/delete?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ TypeName: typeName })
        }),
    getCraftingConfig: () => $.get("/custom/admin/crafting-config?" + window.authz),
    saveCraftingConfig: payload =>
        $.post({
            url: "/custom/admin/crafting-config?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(payload)
        })
};
