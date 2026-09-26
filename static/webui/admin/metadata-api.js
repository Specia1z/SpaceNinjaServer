window.metadataPatchApi = {
    list: () => $.get("/custom/admin/metadata-patches?" + window.authz),
    save: patches =>
        $.post({
            url: "/custom/admin/metadata-patches?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ patches })
        })
};
