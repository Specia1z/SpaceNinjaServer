window.redeemCodesApi = {
    list: () => $.get("/custom/admin/redeem-codes?" + window.authz),
    save: payload =>
        $.post({
            url: "/custom/admin/redeem-codes?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(payload)
        }),
    generate: payload =>
        $.post({
            url: "/custom/admin/redeem-codes/generate?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify(payload)
        }),
    remove: code =>
        $.post({
            url: "/custom/admin/redeem-codes/delete?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ Code: code })
        })
};
