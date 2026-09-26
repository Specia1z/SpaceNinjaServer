window.currencyApi = {
    add: (currency, delta) =>
        $.post({
            url: "/custom/addCurrency?" + window.authz + "&guildId=" + window.guildId,
            contentType: "application/json",
            data: JSON.stringify({ currency, delta })
        })
};
