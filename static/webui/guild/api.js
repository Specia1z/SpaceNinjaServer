const guildPost = (path, guildId, data) =>
    $.post({
        url: `/custom/${path}?${window.authz}&guildId=${guildId}`,
        contentType: "application/json",
        data: JSON.stringify(data)
    });

window.guildApi = {
    get: () => $.get("/custom/getGuild?" + window.authz),
    changeRank: (guildId, targetId, rankChange) =>
        $.get(
            `/api/changeGuildRank.php?${window.authz}&guildId=${guildId}&targetId=${targetId}&rankChange=${rankChange}`
        ),
    kick: accountId =>
        $.post({
            url: "/api/removeFromGuild.php?" + window.authz + "&guildId=" + window.guildId,
            contentType: "application/octet-stream",
            data: JSON.stringify({ userId: accountId })
        }),
    leaveAlliance: guildId => $.get("/api/removeFromAlliance.php?" + window.authz + "&guildId=" + guildId),
    getAlliance: guildId => $.get("/custom/getAlliance?guildId=" + guildId),
    addVaultItem: (guildId, vaultType, items) => guildPost("addVaultTypeCount", guildId, { vaultType, items }),
    techProject: (operation, guildId, items) => guildPost(`${operation}TechProject`, guildId, items),
    setCheat: (guildId, key, value) => guildPost("setGuildCheat", guildId, { key, value }),
    applyCheat: (guildId, cheat) =>
        $.get(`/custom/retroactivelyApplyGuildCheat?${window.authz}&guildId=${guildId}&cheat=${cheat}`)
};
