window.metadataPatchApi = {
    list: selectedAccountId => {
        const query = new URLSearchParams(window.authz);
        if (selectedAccountId) query.set("selectedAccountId", selectedAccountId);
        return $.get("/custom/admin/metadata-patches?" + query.toString());
    },
    save: (patches, accountMetadataPatches, metadataPatchBlacklist, selectedAccountId) => {
        const query = new URLSearchParams(window.authz);
        if (selectedAccountId) query.set("selectedAccountId", selectedAccountId);
        return $.post({
            url: "/custom/admin/metadata-patches?" + query.toString(),
            contentType: "application/json",
            data: JSON.stringify({ patches, accountMetadataPatches, metadataPatchBlacklist })
        });
    }
};
