window.plutoScriptsApi = {
    list: () => $.get("/custom/admin/playwf-scripts?" + window.authz),
    save: scripts =>
        $.post({
            url: "/custom/admin/playwf-scripts?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ scripts })
        })
};
