window.metadataPatchApi = {
    list: accountId => {
        const query = new URLSearchParams(window.authz);
        if (accountId) query.set("accountId", accountId);
        return $.get("/custom/admin/metadata-patches?" + query.toString());
    },
    save: (patches, accountMetadataPatches, accountId) => {
        const query = new URLSearchParams(window.authz);
        if (accountId) query.set("accountId", accountId);
        return $.post({
            url: "/custom/admin/metadata-patches?" + query.toString(),
            contentType: "application/json",
            data: JSON.stringify({ patches, accountMetadataPatches })
        });
    }
};
