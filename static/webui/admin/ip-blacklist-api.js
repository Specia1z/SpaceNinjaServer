window.ipBlacklistApi = {
    get: () => $.get("/custom/admin/ip-blacklist?" + window.authz),
    add: address =>
        $.post({
            url: "/custom/admin/ip-blacklist?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ address })
        }),
    remove: address =>
        $.post({
            url: "/custom/admin/ip-blacklist/delete?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ address })
        })
};
