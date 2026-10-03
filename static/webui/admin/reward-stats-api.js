window.rewardStatsApi = (() => {
    const baseUrl = "/custom/admin/currency-grant-stats";

    return {
        list: async day => {
            await revalidateAuthz();
            const response = await fetch(`${baseUrl}?${window.authz}&day=${encodeURIComponent(day)}`);
            if (!response.ok) {
                const error = new Error((await response.text()) || response.statusText);
                error.status = response.status;
                throw error;
            }
            return response.json();
        }
    };
})();
