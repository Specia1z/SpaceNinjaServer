window.plutoScriptsApi = {
    list: selectedAccountId => {
        const query = new URLSearchParams(window.authz);
        if (selectedAccountId) query.set("selectedAccountId", selectedAccountId);
        return $.get("/custom/admin/playwf-scripts?" + query.toString());
    },
    save: (scripts, accountScripts, accountBlacklist, selectedAccountId) => {
        const query = new URLSearchParams(window.authz);
        if (selectedAccountId) query.set("selectedAccountId", selectedAccountId);
        return $.post({
            url: "/custom/admin/playwf-scripts?" + query.toString(),
            contentType: "application/json",
            data: JSON.stringify({ scripts, accountScripts, accountBlacklist })
        });
    }
};
