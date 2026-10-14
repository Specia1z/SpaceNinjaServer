single.getRoute("/webui/mods").on("beforeload", async function () {
    const [data, itemMap] = await Promise.all([awaitAuthz().then(getInventoryData), window.itemListPromise]);
    const rivenList = document.getElementById("riven-list");
    const modsList = document.getElementById("mods-list");
    rivenList.replaceChildren();
    modsList.replaceChildren();
    const updateCounts = () => {
        document.getElementById("riven-count").textContent = rivenList.rows.length.toLocaleString();
        document.getElementById("mods-count").textContent = modsList.rows.length.toLocaleString();
    };
    updateCounts();

    const addAction = (cell, title, icon, handler) => {
        const link = document.createElement("a");
        link.href = "#";
        link.className = "mods-row-action";
        link.title = title;
        link.setAttribute("aria-label", title);
        link.innerHTML = icons[icon];
        link.addEventListener("click", event => {
            event.preventDefault();
            handler();
            updateCounts();
        });
        cell.appendChild(link);
    };

    const addBadge = (cell, title, icon, value) => {
        const badge = document.createElement("span");
        badge.className = "mods-item-badge";
        badge.title = title;
        badge.textContent = `${icon} ${value}`;
        cell.append(" ", badge);
    };

    const addRow = (list, name) => {
        const row = document.createElement("tr");
        row.className = "mods-item-row";
        const nameCell = document.createElement("td");
        nameCell.className = "mods-item-name";
        nameCell.textContent = name;
        row.appendChild(nameCell);
        const actionCell = document.createElement("td");
        actionCell.className = "text-end text-nowrap mods-row-actions";
        row.appendChild(actionCell);
        list.appendChild(row);
        return { row, nameCell, actionCell };
    };

    for (const item of data.Upgrades) {
        const isRiven = item.ItemType.startsWith("/Lotus/Upgrades/Mods/Randomized/");
        if (isRiven) {
            const rivenType = item.ItemType.slice("/Lotus/Upgrades/Mods/Randomized/".length);
            const fingerprint = JSON.parse(item.UpgradeFingerprint);
            if ("buffs" in fingerprint) {
                const row = document.createElement("tr");
                row.className = "mods-item-row";
                const nameCell = document.createElement("td");
                nameCell.className = "mods-item-name";
                nameCell.textContent = itemMap[fingerprint.compat]?.name ?? fingerprint.compat;
                nameCell.append(" ");
                try {
                    nameCell.append(document.createTextNode(RivenParser.parseRiven(rivenType, fingerprint, 1).name));
                } catch {
                    console.warn("malformed riven", { rivenType, fingerprint });
                    nameCell.append(document.createTextNode("[Malformed Riven]"));
                }
                addBadge(nameCell, loc("code_buffsNumber"), "▲", fingerprint.buffs.length);
                addBadge(nameCell, loc("code_cursesNumber"), "▼", fingerprint.curses.length);
                addBadge(nameCell, loc("code_rerollsNumber"), "⟳", fingerprint.rerolls ?? 0);
                row.appendChild(nameCell);

                const actions = document.createElement("td");
                actions.className = "text-end text-nowrap mods-row-actions";
                const stats = document.createElement("a");
                stats.href =
                    "riven-tool/#" +
                    encodeURIComponent(JSON.stringify({ rivenType, omegaAttenuation: 1, fingerprint }));
                stats.target = "_blank";
                stats.className = "mods-row-action mods-row-action--stats";
                stats.title = loc("code_viewStats");
                stats.setAttribute("aria-label", stats.title);
                stats.innerHTML = icons.chartSimple;
                actions.appendChild(stats);
                addAction(actions, loc("code_remove"), "trash", () => {
                    row.remove();
                    disposeOfGear("Upgrades", item.ItemId.$oid);
                });
                row.appendChild(actions);
                rivenList.appendChild(row);
                continue;
            }
        }

        const rank = parseInt(JSON.parse(item.UpgradeFingerprint).lvl);
        const maxRank = itemMap[item.ItemType]?.fusionLimit ?? 5;
        const { nameCell, actionCell, row } = addRow(modsList, itemMap[item.ItemType]?.name ?? item.ItemType);
        if (itemMap[item.ItemType]?.badReason === "u5mod" && item.UpgradeFingerprint) {
            const fingerprint = JSON.parse(item.UpgradeFingerprint);
            if (fingerprint.fits && itemMap[item.ItemType]?.fits.length > 1) {
                nameCell.textContent = loc("code_U5Mod").replace(
                    "|TYPE|",
                    itemMap[fingerprint.fits]?.name ?? fingerprint.fits
                );
                nameCell.textContent = loc("code_updateSuffix")
                    .replace("|TYPE|", nameCell.textContent)
                    .replace("|VALUE|", "5");
                if (
                    ["/Lotus/Upgrades/Modules/GrineerMeleeModule", "/Lotus/Upgrades/Modules/TennoSwordModule"].includes(
                        item.ItemType
                    )
                ) {
                    nameCell.textContent += ` [${item.ItemType.split("/").pop()}]`;
                }
            }
        } else if (itemMap[item.ItemType]?.badReason !== "notraw" && !Number.isNaN(rank)) {
            addBadge(nameCell, loc("code_rank"), "★", `${rank}/${maxRank}`);
        }

        if (rank < maxRank) {
            addAction(actionCell, loc("code_maxRank"), "arrowUp", () =>
                setFingerprint(item.ItemType, item.ItemId, { lvl: maxRank })
            );
        }
        if (itemMap[item.ItemType]?.badReason === "u5mod") {
            const edit = document.createElement("a");
            edit.href = "/webui/details?productCategory=Upgrades&itemId=" + item.ItemId.$oid;
            edit.title = loc("inventory_openDetails");
            edit.setAttribute("aria-label", edit.title);
            edit.innerHTML = icons.feather;
            actionCell.appendChild(edit);
        }
        addAction(actionCell, loc("code_remove"), "trash", () => {
            row.remove();
            disposeOfGear("Upgrades", item.ItemId.$oid);
        });
    }

    for (const item of data.RawUpgrades) {
        if (item.ItemCount <= 0) continue;
        const maxRank = itemMap[item.ItemType]?.fusionLimit ?? 5;
        const { nameCell, actionCell, row } = addRow(modsList, itemMap[item.ItemType]?.name ?? item.ItemType);
        if (maxRank > 0) addBadge(nameCell, loc("code_rank"), "★", `0/${maxRank}`);
        if (item.ItemCount > 1) addBadge(nameCell, loc("code_count"), "🗍", parseInt(item.ItemCount));
        if (maxRank !== 0) {
            addAction(actionCell, loc("code_maxRank"), "arrowUp", () =>
                setFingerprint(item.ItemType, item.LastAdded, { lvl: maxRank })
            );
        }
        addAction(actionCell, loc("code_remove"), "trash", () => {
            row.remove();
            disposeOfItems("Upgrades", item.ItemType, item.ItemCount);
        });
    }

    updateCounts();
});
