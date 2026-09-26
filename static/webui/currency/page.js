window.doAddCurrency = function (currency) {
    revalidateAuthz().then(() => {
        window.currencyApi
            .add(currency, document.getElementById(currency + "-delta").valueAsNumber)
            .then(function (newValue) {
                if (currency.startsWith("Vault")) {
                    document.getElementById(currency + "-owned").textContent = loc(
                        "guildView_currency_owned"
                    ).replaceAll("|COUNT|", (newValue ?? 0).toLocaleString());
                } else {
                    inventory_data[currency] = newValue;
                    document.getElementById(currency + "-owned").textContent = loc("currency_owned").replaceAll(
                        "|COUNT|",
                        (newValue ?? 0).toLocaleString()
                    );
                }
            });
    });
};
