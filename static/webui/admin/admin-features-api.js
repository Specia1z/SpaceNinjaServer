window.adminFeaturesApi = {
    get: () => $.get("/custom/admin/features?" + window.authz),
    save: newAccountWelcome =>
        $.post({
            url: "/custom/admin/features?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ newAccountWelcome })
        })
};
