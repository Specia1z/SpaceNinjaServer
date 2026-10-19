window.adminDropTableApi = {
    list: ({ page, pageSize, search }) =>
        $.get(
            "/custom/admin/drop-tables?" +
                window.authz +
                `&lang=${encodeURIComponent(window.lang ?? "en")}&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}&search=${encodeURIComponent(search)}`
        ),
    detail: dropTable =>
        $.get(
            "/custom/admin/drop-tables/detail?" +
                window.authz +
                `&lang=${encodeURIComponent(window.lang ?? "en")}&DropTable=${encodeURIComponent(dropTable)}`
        ),
    save: payload =>
        $.post({
            url: "/custom/admin/drop-tables?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(payload)
        }),
    delete: dropTable =>
        $.post({
            url: "/custom/admin/drop-tables/delete?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ DropTable: dropTable })
        })
};
