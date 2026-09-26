window.suspicionApi = (() => {
    const baseUrl = "/custom/admin/suspicion-events";
    return {
        list: () => $.get(`${baseUrl}?${window.authz}`),
        detail: accountId =>
            $.get(`${baseUrl}/detail?${window.authz}&targetAccountId=${encodeURIComponent(accountId)}`),
        ban: (accountId, banned) =>
            $.post({
                url: `${baseUrl}/ban?${window.authz}`,
                contentType: "application/json",
                data: JSON.stringify({ AccountId: accountId, Banned: banned })
            }),
        clear: accountId =>
            $.post({
                url: `${baseUrl}/clear?${window.authz}`,
                contentType: "application/json",
                data: JSON.stringify(accountId ? { AccountId: accountId } : { All: true })
            })
    };
})();
