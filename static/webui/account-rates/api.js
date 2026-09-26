window.accountRatesApi = (() => {
    const baseUrl = "/custom/admin/account-rates";

    async function request(path = "", body) {
        await revalidateAuthz();
        const response = await fetch(
            `${baseUrl}${path}?${window.authz}`,
            body === undefined
                ? undefined
                : {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body)
                  }
        );
        if (!response.ok) {
            const error = new Error((await response.text()) || response.statusText);
            error.status = response.status;
            throw error;
        }
        return response.status === 204 || path === "/delete" ? undefined : response.json();
    }

    return {
        list: () => request(),
        save: (accountId, profile) => request("", { accountId, profile }),
        remove: accountId => request("/delete", { accountId })
    };
})();
