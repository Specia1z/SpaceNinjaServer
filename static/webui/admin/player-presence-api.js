window.playerPresenceApi = (() => {
    const baseUrl = "/custom/admin/player-presence";
    const language = () => encodeURIComponent(window.lang || "en");
    return {
        list: search =>
            $.get(
                `${baseUrl}?${window.authz}&lang=${language()}&limit=2000&search=${encodeURIComponent(search || "")}`
            ),
        history: accountId =>
            $.get(`${baseUrl}/history?${window.authz}&lang=${language()}&accountId=${encodeURIComponent(accountId)}`)
    };
})();
