window.playerPresenceApi = (() => {
    const baseUrl = "/custom/admin/player-presence";
    return {
        list: search => $.get(`${baseUrl}?${window.authz}&limit=2000&search=${encodeURIComponent(search || "")}`),
        history: accountId => $.get(`${baseUrl}/history?${window.authz}&accountId=${encodeURIComponent(accountId)}`)
    };
})();
