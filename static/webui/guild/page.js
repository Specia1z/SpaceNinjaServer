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

    function clearView() {
        document.getElementById("guildView-title").textContent = "";
        document.getElementById("guildView-tier").textContent = "";
        document.getElementById("guildView-class").textContent = "";
        document.getElementById("vaultRegularCredits-form").classList.add("d-none");
        document.getElementById("vaultPremiumCredits-form").classList.add("d-none");
        document.getElementById("VaultRegularCredits-owned").classList.add("mb-0");
        document.getElementById("VaultPremiumCredits-owned").classList.add("mb-0");
        document.getElementById("TechProjects-list").innerHTML = "";
        document.getElementById("techProjects-form").classList.add("d-none");
        document.getElementById("acquire-type-TechProjects").value = "";
        document.getElementById("VaultDecoRecipes-list").innerHTML = "";
        document.getElementById("vaultDecoRecipes-form").classList.add("d-none");
        document.getElementById("acquire-type-VaultDecoRecipes").value = "";
        document.getElementById("VaultMiscItems-list").innerHTML = "";
        document.getElementById("vaultMiscItems-form").classList.add("d-none");
        document.getElementById("acquire-type-VaultMiscItems").value = "";
        document.getElementById("VaultShipDecorations-list").innerHTML = "";
        document.getElementById("vaultShipDecorations-form").classList.add("d-none");
        document.getElementById("acquire-type-VaultShipDecorations").value = "";
        document.getElementById("Alliance-list").innerHTML = "";
        document.getElementById("guildView-alliance").textContent = "";
        document.getElementById("Members-list").innerHTML = "";
        $("#guild-route > .row").addClass("d-none");
    }

    function renderOverview(guildData, itemMap) {
        [
            "TechProjects-bulkAdd",
            "TechProjects-bulkFund",
            "TechProjects-bulkComplete",
            "TechProjects-bulkRemove",
            "VaultDecoRecipes-bulkAdd",
            "VaultDecoRecipes-bulkRemove",
            "VaultShipDecorations-bulkRemove",
            "VaultShipDecorations-bulkAdd",
            "VaultMiscItems-bulkRemove"
        ].forEach(id => document.getElementById(id).classList.add("d-none"));
        document.getElementById("guildView-loading").classList.add("d-none");
        $("#guild-route > .row").removeClass("d-none");

        document.getElementById("guildView-title").textContent = guildData.Name;
        document.getElementById("guildView-tier").textContent = normalizeText(
            itemMap["/Lotus/Language/Clan/Clan_TierDisplay"].name.replaceAll(
                "|TIER|",
                itemMap[`/Lotus/Language/Clan/Clan_Tier${guildData.Tier}`].name
            )
        );
        document.getElementById("guildView-class").textContent = itemMap[
            "/Lotus/Language/Clan/Clan_ClassLower"
        ].name.replaceAll("|CLASS|", guildData.Class);

        ["VaultRegularCredits", "VaultPremiumCredits"].forEach(currency => {
            document.getElementById(currency + "-owned").textContent = loc("guildView_currency_owned").replaceAll(
                "|COUNT|",
                (guildData[currency] ?? 0).toLocaleString()
            );
        });

        const userGuildMember = guildData.Members.find(member => member._id.$oid === window.accountId);
        let userGuildPermissions;
        if (userGuildMember) {
            userGuildPermissions = guildData.Ranks[userGuildMember.Rank].Permissions;
            if (userGuildPermissions & 128) {
                document.getElementById("techProjects-form").classList.remove("d-none");
            }
            if (userGuildPermissions & 16) {
                document.getElementById("vaultDecoRecipes-form").classList.remove("d-none");
            }
            if (userGuildPermissions & 64) {
                document.getElementById("vaultRegularCredits-form").classList.remove("d-none");
                document.getElementById("VaultRegularCredits-owned").classList.remove("mb-0");
                document.getElementById("vaultPremiumCredits-form").classList.remove("d-none");
                document.getElementById("VaultPremiumCredits-owned").classList.remove("mb-0");
                document.getElementById("vaultMiscItems-form").classList.remove("d-none");
                document.getElementById("vaultShipDecorations-form").classList.remove("d-none");
            }
            if (userGuildMember.Rank <= 1) {
                [
                    "TechProjects-bulkAdd",
                    "TechProjects-bulkFund",
                    "TechProjects-bulkComplete",
                    "TechProjects-bulkRemove",
                    "VaultDecoRecipes-bulkAdd",
                    "VaultDecoRecipes-bulkRemove",
                    "VaultShipDecorations-bulkRemove",
                    "VaultShipDecorations-bulkAdd",
                    "VaultMiscItems-bulkRemove"
                ].forEach(id => document.getElementById(id).classList.remove("d-none"));
            }
        }

        for (const elm of document.querySelectorAll("#guild-cheats input[id]")) {
            elm.checked = !!guildData[elm.id];
            elm.disabled = !userGuildMember || userGuildMember.Rank > 1;
        }
        return { userGuildMember, userGuildPermissions };
    }

    function addAction(cell, title, icon, onClick) {
        const link = document.createElement("a");
        link.href = "#";
        link.title = title;
        link.innerHTML = icon;
        link.onclick = event => {
            event.preventDefault();
            onClick();
        };
        cell.appendChild(link);
    }

    function renderInventoryLists(guildData, itemMap, userGuildMember, userGuildPermissions) {
        const projects = document.getElementById("TechProjects-list");
        projects.innerHTML = "";
        guildData.TechProjects ??= [];
        guildData.TechProjects.forEach(item => {
            const row = document.createElement("tr");
            row.setAttribute("data-item-type", item.ItemType);
            const name = document.createElement("td");
            name.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
            if (new Date(item.CompletionDate) < new Date()) {
                name.textContent += " | " + loc("code_completed");
            } else if (item.State == 1) {
                name.textContent += " | " + loc("code_funded");
            }
            row.appendChild(name);
            const actions = document.createElement("td");
            actions.classList = "text-end text-nowrap";
            if (userGuildPermissions && userGuildPermissions & 128 && item.State != 1) {
                addAction(actions, loc("code_fund"), icons.arrowUp, () =>
                    debounce(fundGuildTechProject, item.ItemType)
                );
            }
            if (
                userGuildPermissions &&
                userGuildPermissions & 128 &&
                item.State == 1 &&
                new Date(item.CompletionDate) > new Date()
            ) {
                addAction(actions, loc("code_complete"), icons.forward, () =>
                    debounce(completeGuildTechProject, item.ItemType)
                );
            }
            if (userGuildMember && userGuildMember.Rank <= 1) {
                addAction(actions, loc("code_remove"), icons.trash, () =>
                    debounce(removeGuildTechProject, item.ItemType)
                );
            }
            row.appendChild(actions);
            projects.appendChild(row);
        });

        ["VaultDecoRecipes", "VaultMiscItems", "VaultShipDecorations"].forEach(vaultKey => {
            const list = document.getElementById(vaultKey + "-list");
            list.innerHTML = "";
            (guildData[vaultKey] ??= []).forEach(item => {
                const row = document.createElement("tr");
                row.setAttribute("data-item-type", item.ItemType);
                const name = document.createElement("td");
                name.textContent = itemMap[item.ItemType]?.name ?? item.ItemType;
                if (item.ItemCount > 1) {
                    name.innerHTML += ` <span title='${loc("code_count")}'>🗍 ${parseInt(item.ItemCount)}</span>`;
                }
                row.appendChild(name);
                const actions = document.createElement("td");
                actions.classList = "text-end text-nowrap";
                const canRemove =
                    vaultKey === "VaultDecoRecipes"
                        ? userGuildMember && userGuildMember.Rank <= 1
                        : userGuildPermissions && userGuildPermissions & 64;
                if (canRemove) {
                    addAction(actions, loc("code_remove"), icons.trash, () =>
                        removeVaultItem(vaultKey, item.ItemType, item.ItemCount * -1)
                    );
                }
                row.appendChild(actions);
                list.appendChild(row);
            });
        });
    }

    function renderMembers(guildData, itemMap, userGuildMember, userGuildPermissions) {
        const list = document.getElementById("Members-list");
        list.innerHTML = "";
        guildData.Members.forEach(member => {
            const row = document.createElement("tr");
            const name = document.createElement("td");
            const memberRank = guildData.Ranks[member.Rank];
            name.textContent = member.DisplayName;
            name.textContent += " | " + itemMap[memberRank.Name]?.name ?? memberRank.Name;
            if (member.Status != 0) name.textContent += " | " + loc("guildView_pending");
            row.appendChild(name);
            const actions = document.createElement("td");
            actions.classList = "text-end text-nowrap";
            if (
                userGuildMember &&
                member.Rank > userGuildMember.Rank &&
                userGuildPermissions &&
                userGuildPermissions & 8
            ) {
                addAction(actions, itemMap["/Lotus/Language/Menu/SocialOverlay_Promote"].name, icons.angleUp, () =>
                    changeGuildRank(window.guildId, member._id.$oid, member.Rank - 1)
                );
            }
            if (
                userGuildMember &&
                member.Rank < 8 &&
                member.Rank > userGuildMember.Rank &&
                userGuildPermissions &&
                userGuildPermissions & 8
            ) {
                addAction(actions, itemMap["/Lotus/Language/Menu/SocialOverlay_Demote"].name, icons.angleDown, () =>
                    changeGuildRank(window.guildId, member._id.$oid, member.Rank + 1)
                );
            }
            if (
                (userGuildMember &&
                    member.Rank > userGuildMember.Rank &&
                    userGuildPermissions &&
                    userGuildPermissions & 4) ||
                (userGuildMember && userGuildMember.Rank != 0 && userGuildMember._id == member._id)
            ) {
                addAction(actions, loc("code_remove"), icons.trash, () => kickFromGuild(member._id.$oid));
            }
            row.appendChild(actions);
            list.appendChild(row);
        });
    }

    function renderAlliance(guildData, itemMap, userGuildMember) {
        if (!guildData.AllianceId) return;
        window.guildApi.getAlliance(window.guildId).done(allianceData => {
            document.getElementById("guildView-alliance").textContent =
                itemMap["/Lotus/Language/Clan/Clan_AllianceBtnTitle"].name + ": " + allianceData.Name;
            let userAlliancePermisssions;
            if (userGuildMember && userGuildMember.Rank <= 1) {
                userAlliancePermisssions = allianceData.Clans.find(
                    clan => clan._id.$oid === window.guildId
                ).Permissions;
            }
            const list = document.getElementById("Alliance-list");
            list.innerHTML = "";
            allianceData.Clans.forEach(clan => {
                const row = document.createElement("tr");
                const name = document.createElement("td");
                name.textContent = clan.Name;
                if (clan.Pending) {
                    name.textContent +=
                        " | " + normalizeText(itemMap["/Lotus/Language/Menu/SocialOverlay_PendingLabel"].name);
                }
                row.appendChild(name);
                const actions = document.createElement("td");
                actions.classList = "text-end text-nowrap";
                if (!(clan.Permissions & 1) && userAlliancePermisssions && userAlliancePermisssions & 1) {
                    addAction(actions, loc("code_remove"), icons.trash, () => kickFromAlliance(clan._id.$oid));
                }
                row.appendChild(actions);
                list.appendChild(row);
            });
        });
    }

    function loadGuildRoute() {
        if (window.guild_data === undefined) {
            document.getElementById("guildView-loading").classList.remove("d-none");
            document.getElementById("guildView-na").classList.add("d-none");
            document.getElementById("guildView-naDescription").classList.add("d-none");
            clearView();
        }
        awaitAuthz().then(() => {
            getGuildData().then(guildData => {
                if (!guildData) {
                    document.getElementById("guildView-loading").classList.add("d-none");
                    document.getElementById("guildView-na").classList.remove("d-none");
                    document.getElementById("guildView-naDescription").classList.remove("d-none");
                    clearView();
                    return;
                }
                window.itemListPromise.then(itemMap => {
                    const { userGuildMember, userGuildPermissions } = renderOverview(guildData, itemMap);
                    renderInventoryLists(guildData, itemMap, userGuildMember, userGuildPermissions);
                    renderMembers(guildData, itemMap, userGuildMember, userGuildPermissions);
                    renderAlliance(guildData, itemMap, userGuildMember);
                });
            });
        });
    }

    function initializeHeaders() {
        document.querySelectorAll(".card-header[data-guildCardType]").forEach(header => {
            header.innerHTML = "";
            header.classList.remove(...header.classList);
            header.classList.add("card-header", "d-flex", "justify-content-between", "align-items-center");
            const cardType = header.dataset.guildcardtype;
            const heading = document.createElement("h5");
            heading.classList.add("mb-0");
            const locKey = `guildView_${cardType.charAt(0).toLowerCase() + cardType.slice(1)}`;
            heading.textContent = loc(locKey);
            heading.setAttribute("data-loc", locKey);
            header.appendChild(heading);
            const buttons = document.createElement("div");
            buttons.classList.add("d-flex", "gap-2");
            const addButton = (suffix, titleKey, icon, action) => {
                const link = document.createElement("a");
                link.href = "#";
                link.onclick = event => {
                    event.preventDefault();
                    action();
                };
                link.setAttribute("data-loc-title", titleKey);
                link.title = loc(titleKey);
                link.innerHTML = icon;
                link.id = `${cardType}-${suffix}`;
                buttons.appendChild(link);
            };
            if (cardType != "VaultMiscItems") {
                addButton("bulkAdd", "inventory_bulkAdd", icons.plus, () =>
                    cardType != "TechProjects"
                        ? debounce(addMissingVaultItems, cardType)
                        : debounce(addMissingTechProjects)
                );
            }
            if (cardType == "TechProjects") {
                addButton("bulkFund", "guildView_bulkFund", icons.arrowUp, () => debounce(fundAllTechProjects));
                addButton("bulkComplete", "inventory_bulkComplete", icons.forward, () =>
                    debounce(completeAllTechProjects)
                );
            }
            addButton("bulkRemove", "inventory_bulkRemove", icons.trash, () =>
                cardType != "TechProjects" ? debounce(bulkRemoveVaultItems, cardType) : debounce(bulkRemoveTechProjects)
            );
            header.appendChild(buttons);
        });
    }

    function bindGuildCheats() {
        document.querySelectorAll("#guild-cheats input[type=checkbox]").forEach(elm => {
            elm.onchange = function () {
                revalidateAuthz().then(() => {
                    window.guildApi.setCheat(window.guildId, elm.id, elm.checked).done(res => {
                        if (res == "retroactivable" && window.confirm(loc("cheats_retroactivePrompt"))) {
                            window.guildApi.applyCheat(window.guildId, elm.id);
                        }
                    });
                });
            };
        });
    }

    function submitGuildMutation(request, onSuccess = () => {}) {
        return new Promise(resolve => {
            revalidateAuthz().then(() => {
                request().done(() => {
                    onSuccess();
                    updateGuild();
                    resolve();
                });
            });
        });
    }

    function dispatchAddVaultItemsBatch(requests, vaultType) {
        return submitGuildMutation(() => window.guildApi.addVaultItem(window.guildId, vaultType, requests));
    }

    function dispatchAddTechProjectsBatch(requests) {
        return submitGuildMutation(() => window.guildApi.techProject("add", window.guildId, requests));
    }

    function dispatchRemoveTechProjectsBatch(requests) {
        return submitGuildMutation(() => window.guildApi.techProject("remove", window.guildId, requests));
    }

    function dispatchFundTechProjectsBatch(requests) {
        return submitGuildMutation(() => window.guildApi.techProject("fund", window.guildId, requests));
    }

    function dispatchCompleteTechProjectsBatch(requests) {
        return submitGuildMutation(() => window.guildApi.techProject("complete", window.guildId, requests));
    }

    function addVaultItem(vaultType) {
        const ItemType = getKey(document.getElementById(`acquire-type-${vaultType}`));
        if (!ItemType) {
            $(`#acquire-type-${vaultType}`).addClass("is-invalid").focus();
            return;
        }
        const ItemCount = ["VaultMiscItems", "VaultShipDecorations"].includes(vaultType)
            ? parseInt($(`#${vaultType}-count`).val())
            : 1;
        if (ItemCount != 0 && !Number.isNaN(ItemCount)) {
            submitGuildMutation(
                () => window.guildApi.addVaultItem(window.guildId, vaultType, [{ ItemType, ItemCount }]),
                () => {
                    document.getElementById(`acquire-type-${vaultType}`).value = "";
                }
            );
        }
    }

    function removeVaultItem(vaultType, ItemType, ItemCount) {
        submitGuildMutation(() => window.guildApi.addVaultItem(window.guildId, vaultType, [{ ItemType, ItemCount }]));
    }

    function addGuildTechProject() {
        const ItemType = getKey(document.getElementById("acquire-type-TechProjects"));
        if (!ItemType) {
            $("#acquire-type-TechProjects").addClass("is-invalid").focus();
            return;
        }
        submitGuildMutation(
            () => window.guildApi.techProject("add", window.guildId, [{ ItemType }]),
            () => {
                document.getElementById("acquire-type-TechProjects").value = "";
            }
        );
    }

    function removeGuildTechProject(ItemType) {
        submitGuildMutation(() => window.guildApi.techProject("remove", window.guildId, [{ ItemType }]));
    }

    function completeGuildTechProject(ItemType) {
        submitGuildMutation(() => window.guildApi.techProject("complete", window.guildId, [{ ItemType }]));
    }

    function fundGuildTechProject(ItemType) {
        submitGuildMutation(() => window.guildApi.techProject("fund", window.guildId, [{ ItemType }]));
    }

    function confirmGuildBatch(requests, message, dispatch) {
        if (requests.length && window.confirm(replacePluralForms(loc(message), { COUNT: requests.length }))) {
            return dispatch(requests);
        }
    }

    function collectVaultItems(vaultType, remove) {
        const requests = [];
        const datalist = vaultType === "VaultShipDecorations" ? "ShipDecorations" : vaultType;
        document.querySelectorAll(`#datalist-${datalist} option`).forEach(elm => {
            const ItemType = elm.getAttribute("data-key");
            const owned = !!document.querySelector(`#${vaultType}-list [data-item-type='${ItemType}']`);
            if (owned === remove) {
                const count = vaultType === "VaultShipDecorations" ? 999999 : 1;
                requests.push({ ItemType, ItemCount: remove ? -count : count });
            }
        });
        return requests;
    }

    function addMissingVaultItems(vaultType) {
        return confirmGuildBatch(collectVaultItems(vaultType, false), "code_addVaultItemsConfirm", requests =>
            dispatchAddVaultItemsBatch(requests, vaultType)
        );
    }

    function bulkRemoveVaultItems(vaultType) {
        return confirmGuildBatch(collectVaultItems(vaultType, true), "code_removeVaultItemsConfirm", requests =>
            dispatchAddVaultItemsBatch(requests, vaultType)
        );
    }

    function collectTechProjects(remove) {
        const requests = [];
        document.querySelectorAll("#datalist-TechProjects option").forEach(elm => {
            const ItemType = elm.getAttribute("data-key");
            const owned = !!document.querySelector(`#TechProjects-list [data-item-type='${ItemType}']`);
            if (owned === remove) requests.push({ ItemType });
        });
        return requests;
    }

    function addMissingTechProjects() {
        return confirmGuildBatch(
            collectTechProjects(false),
            "code_addTechProjectsConfirm",
            dispatchAddTechProjectsBatch
        );
    }

    function bulkRemoveTechProjects() {
        return confirmGuildBatch(
            collectTechProjects(true),
            "code_removeTechProjectsConfirm",
            dispatchRemoveTechProjectsBatch
        );
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
        clearView,
        renderOverview,
        renderInventoryLists,
        renderMembers,
        renderAlliance,
        load: loadGuildRoute,
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
        addVaultItem,
        removeVaultItem,
        addGuildTechProject,
        removeGuildTechProject,
        completeGuildTechProject,
        fundGuildTechProject,
        dispatchAddVaultItemsBatch,
        dispatchAddTechProjectsBatch,
        dispatchRemoveTechProjectsBatch,
        dispatchFundTechProjectsBatch,
        dispatchCompleteTechProjectsBatch,
        addMissingVaultItems,
        bulkRemoveVaultItems,
        addMissingTechProjects,
        bulkRemoveTechProjects,
        fundAllTechProjects,
        completeAllTechProjects
    });
    single.getRoute("#guild-route").on("beforeload", loadGuildRoute);
    window.dictPromise.then(initializeHeaders);
    bindGuildCheats();
})();
