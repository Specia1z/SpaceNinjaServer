(() => {
    let cachedGuild;

    async function getGuildData() {
        if (cachedGuild) return cachedGuild;
        cachedGuild = await window.guildApi.get();
        window.guild_data = cachedGuild;
        window.guildId = cachedGuild?._id ?? null;
        if (window.subscribedToGuildId != window.guildId) {
            window.subscribedToGuildId = window.guildId;
            window.ws?.send(JSON.stringify({ guildId: window.guildId }));
        }
        return cachedGuild;
    }

    function fundAllTechProjects() {
        revalidateAuthz().then(() => {
            getGuildData().then(data => {
                const requests = [];
                data.TechProjects ??= [];
                data.TechProjects.forEach(techProject => {
                    if (techProject.State != 1) {
                        requests.push({ ItemType: techProject.ItemType });
                    }
                });
                if (requests.length > 0) return dispatchFundTechProjectsBatch(requests);
            });
        });
    }

    function completeAllTechProjects() {
        revalidateAuthz().then(() => {
            getGuildData().then(data => {
                const requests = [];
                data.TechProjects ??= [];
                data.TechProjects.forEach(techProject => {
                    if (techProject.State == 1 && new Date(techProject.CompletionDate) > new Date()) {
                        requests.push({ ItemType: techProject.ItemType });
                    }
                });
                if (requests.length > 0) return dispatchCompleteTechProjectsBatch(requests);
            });
        });
    }

    window.guildPage = {
        reset: () => {
            cachedGuild = undefined;
            window.guild_data = undefined;
        },
        reload: () => updateGuild(),
        get: getGuildData
    };

    Object.assign(window, {
        changeGuildRank: (guildId, targetId, rankChange) => {
            void revalidateAuthz()
                .then(() => window.guildApi.changeRank(guildId, targetId, rankChange))
                .then(window.guildPage.reload);
        },
        kickFromGuild: accountId => {
            void revalidateAuthz()
                .then(() => window.guildApi.kick(accountId))
                .then(window.guildPage.reload);
        },
        kickFromAlliance: guildId => {
            void revalidateAuthz()
                .then(() => window.guildApi.leaveAlliance(guildId))
                .then(window.guildPage.reload);
        },
        getGuildData,
        fundAllTechProjects,
        completeAllTechProjects
    });
})();
