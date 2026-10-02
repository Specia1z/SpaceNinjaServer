window.adminStorePriceApi = {
    list: ({ page, pageSize, search }) =>
        $.get(
            "/custom/admin/store-price-catalog?" +
                window.authz +
                `&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}&search=${encodeURIComponent(search)}`
        ),
    sync: () =>
        $.post({
            url: "/custom/admin/store-prices/sync?" + window.authz,
            contentType: "application/json",
            data: "{}"
        }),
    save: payload =>
        $.post({
            url: "/custom/admin/store-prices/manual?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(payload)
        }),
    delete: typeName =>
        $.post({
            url: "/custom/admin/store-prices/manual/delete?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ TypeName: typeName })
        })
};
