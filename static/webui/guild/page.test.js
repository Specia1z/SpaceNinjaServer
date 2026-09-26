import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadGuildModules(initialDocument = { querySelectorAll: () => [] }) {
    const requests = [];
    const subscriptions = [];
    let guildId = "guild-one";
    let guildData = { _id: guildId };
    let allianceData;
    let cheatResponse;
    let reloads = 0;
    let resolveDictionary;
    const routeHandlers = new Map();
    const context = {
        authz: "auth=token",
        guildId,
        dictPromise: new Promise(resolve => {
            resolveDictionary = resolve;
        }),
        document: initialDocument,
        single: { getRoute: () => ({ on: (event, handler) => routeHandlers.set(event, handler) }) },
        subscribedToGuildId: undefined,
        ws: { send: message => subscriptions.push(JSON.parse(message)) },
        $: {
            get(url) {
                requests.push({ method: "GET", url });
                const value = url.startsWith("/custom/getGuild?") ? guildData : allianceData;
                const response = Promise.resolve(value);
                response.done = callback => {
                    response.then(callback);
                    return response;
                };
                return response;
            },
            post(options) {
                requests.push({ method: "POST", ...options });
                const response = Promise.resolve(cheatResponse);
                response.done = callback => {
                    response.then(callback);
                    return response;
                };
                return response;
            }
        },
        revalidateAuthz: () => Promise.resolve(),
        updateGuild() {
            reloads++;
            context.guildPage.reset();
        }
    };
    context.window = context;
    for (const name of ["api.js", "page.js"]) {
        vm.runInNewContext(readFileSync(new URL(name, import.meta.url), "utf8"), context, { filename: name });
    }
    return {
        context,
        requests,
        subscriptions,
        routeHandlers,
        initializeHeaders: () => resolveDictionary(),
        setGuildData: value => {
            guildData = value;
        },
        setAllianceData: value => {
            allianceData = value;
        },
        setCheatResponse: value => {
            cheatResponse = value;
        },
        setProjects: projects => {
            guildData.TechProjects = projects;
        },
        setGuildId: value => {
            guildId = value;
            guildData = { _id: guildId };
        },
        reloads: () => reloads
    };
}

function attachGuildRouteDom(context) {
    const elements = new Map();
    const debounced = [];
    const makeElement = id => {
        const classes = new Set();
        let html = "";
        return {
            id,
            children: [],
            dataset: {},
            attributes: {},
            value: "",
            textContent: "",
            classList: {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name),
                [Symbol.iterator]: () => classes[Symbol.iterator]()
            },
            set innerHTML(value) {
                html = String(value);
                if (value === "") this.children = [];
            },
            get innerHTML() {
                return html;
            },
            setAttribute(name, value) {
                this.attributes[name] = value;
            },
            getAttribute(name) {
                return this.attributes[name];
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            }
        };
    };
    const get = id => {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
    };
    const rowClasses = new Set();
    const cheats = [makeElement("HasGuildRichStuff")];
    const headers = [makeElement("TechProjects-header"), makeElement("VaultMiscItems-header")];
    headers[0].dataset.guildcardtype = "TechProjects";
    headers[1].dataset.guildcardtype = "VaultMiscItems";
    const ajax = context.$;
    const jquery = () => ({
        addClass: name => rowClasses.add(name),
        removeClass: name => rowClasses.delete(name)
    });
    jquery.get = ajax.get;
    jquery.post = ajax.post;
    context.$ = jquery;
    context.document = {
        getElementById: get,
        createElement: makeElement,
        querySelectorAll(selector) {
            if (selector === "#guild-cheats input[id]" || selector === "#guild-cheats input[type=checkbox]")
                return cheats;
            if (selector === ".card-header[data-guildCardType]") return headers;
            return [];
        }
    };
    context.awaitAuthz = () => Promise.resolve();
    context.normalizeText = value => value;
    context.loc = key => (key === "guildView_currency_owned" ? "Owned |COUNT|" : key);
    context.icons = {
        arrowUp: "up",
        forward: "forward",
        trash: "trash",
        angleUp: "promote",
        angleDown: "demote",
        plus: "plus"
    };
    context.debounce = (func, ...args) => debounced.push([func.name, ...args]);
    return { get, debounced, headers, cheats, rowClasses };
}

function attachGuildFormDom(context, options = {}, owned = []) {
    const elements = new Map();
    const counts = new Map();
    const invalid = [];
    const confirmations = [];
    context.document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, { value: "", key: undefined });
            return elements.get(id);
        },
        querySelectorAll(selector) {
            return (options[selector] ?? []).map(key => ({ getAttribute: () => key }));
        },
        querySelector(selector) {
            return owned.some(key => selector.includes(`[data-item-type='${key}']`)) ? {} : null;
        }
    };
    const ajax = context.$;
    const jquery = selector => ({
        val: () => counts.get(selector),
        addClass(className) {
            invalid.push([selector, className]);
            return this;
        },
        focus() {
            return this;
        }
    });
    jquery.get = ajax.get;
    jquery.post = ajax.post;
    context.$ = jquery;
    context.getKey = input => input.key;
    context.loc = key => key;
    context.replacePluralForms = (message, { COUNT }) => `${message}:${COUNT}`;
    context.confirm = message => {
        confirmations.push(message);
        return true;
    };
    return { elements, counts, invalid, confirmations };
}

void test("guild cache is reused until reset, then resubscribes to new guild", async () => {
    const { context, requests, subscriptions, setGuildId } = loadGuildModules();
    assert.equal((await context.getGuildData())._id, "guild-one");
    assert.equal((await context.getGuildData())._id, "guild-one");
    assert.equal(requests.filter(request => request.url.startsWith("/custom/getGuild?")).length, 1);
    assert.equal(context.guild_data._id, "guild-one");
    context.guildPage.reset();
    setGuildId("guild-two");
    assert.equal((await context.getGuildData())._id, "guild-two");
    assert.equal(requests.filter(request => request.url.startsWith("/custom/getGuild?")).length, 2);
    assert.deepEqual(subscriptions, [{ guildId: "guild-one" }, { guildId: "guild-two" }]);
});

void test("guild member mutations preserve endpoints and invalidate cache on success", async () => {
    const { context, requests, reloads } = loadGuildModules();
    await context.getGuildData();
    context.changeGuildRank("guild-one", "member", -1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(
        requests[1].url,
        "/api/changeGuildRank.php?auth=token&guildId=guild-one&targetId=member&rankChange=-1"
    );
    context.kickFromGuild("member");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests[2].url, "/api/removeFromGuild.php?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[2].data), { userId: "member" });
    context.kickFromAlliance("guild-one");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests[3].url, "/api/removeFromAlliance.php?auth=token&guildId=guild-one");
    assert.equal(reloads(), 3);
    assert.equal(context.guild_data, undefined);
});

void test("guild vault and project requests retain their payloads", async () => {
    const { context, requests } = loadGuildModules();
    await context.guildApi.addVaultItem("guild-one", "VaultMiscItems", [{ ItemType: "item", ItemCount: -2 }]);
    await context.guildApi.techProject("fund", "guild-one", [{ ItemType: "project" }]);
    assert.equal(requests[0].url, "/custom/addVaultTypeCount?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[0].data), {
        vaultType: "VaultMiscItems",
        items: [{ ItemType: "item", ItemCount: -2 }]
    });
    assert.equal(requests[1].url, "/custom/fundTechProject?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[1].data), [{ ItemType: "project" }]);
});

void test("bulk project actions select only fundable and incomplete research", async () => {
    const { context, requests, setProjects, reloads } = loadGuildModules();
    setProjects([
        { ItemType: "unfunded", State: 0 },
        { ItemType: "running", State: 1, CompletionDate: new Date(Date.now() + 86400000).toISOString() },
        { ItemType: "finished", State: 1, CompletionDate: new Date(Date.now() - 86400000).toISOString() }
    ]);
    context.fundAllTechProjects();
    await new Promise(resolve => setImmediate(resolve));
    context.completeAllTechProjects();
    await new Promise(resolve => setImmediate(resolve));
    const posts = requests.filter(request => request.method === "POST");
    assert.deepEqual(
        posts.map(post => [post.url, JSON.parse(post.data)]),
        [
            ["/custom/fundTechProject?auth=token&guildId=guild-one", [{ ItemType: "unfunded" }]],
            ["/custom/completeTechProject?auth=token&guildId=guild-one", [{ ItemType: "running" }]]
        ]
    );
    assert.equal(reloads(), 2);
});

void test("single guild forms validate inputs and refresh after successful updates", async () => {
    const { context, requests, reloads } = loadGuildModules();
    const { elements, counts, invalid } = attachGuildFormDom(context);
    context.addVaultItem("VaultMiscItems");
    context.addGuildTechProject();
    assert.deepEqual(invalid, [
        ["#acquire-type-VaultMiscItems", "is-invalid"],
        ["#acquire-type-TechProjects", "is-invalid"]
    ]);
    assert.equal(requests.length, 0);
    elements.get("acquire-type-VaultMiscItems").key = "ore";
    elements.get("acquire-type-VaultMiscItems").value = "ore";
    counts.set("#VaultMiscItems-count", "3");
    context.addVaultItem("VaultMiscItems");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get("acquire-type-VaultMiscItems").value, "");
    assert.deepEqual(JSON.parse(requests[0].data), {
        vaultType: "VaultMiscItems",
        items: [{ ItemType: "ore", ItemCount: 3 }]
    });
    elements.get("acquire-type-TechProjects").key = "project";
    elements.get("acquire-type-TechProjects").value = "project";
    context.addGuildTechProject();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get("acquire-type-TechProjects").value, "");
    assert.equal(requests[1].url, "/custom/addTechProject?auth=token&guildId=guild-one");
    context.removeVaultItem("VaultMiscItems", "ore", -2);
    await new Promise(resolve => setImmediate(resolve));
    context.fundGuildTechProject("project");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(JSON.parse(requests[2].data).items, [{ ItemType: "ore", ItemCount: -2 }]);
    assert.equal(requests[3].url, "/custom/fundTechProject?auth=token&guildId=guild-one");
    assert.equal(reloads(), 4);
});

void test("bulk clan forms select missing or owned items with original counts", async () => {
    const { context, requests, reloads } = loadGuildModules();
    const { confirmations } = attachGuildFormDom(
        context,
        {
            "#datalist-ShipDecorations option": ["missing-deco", "owned-deco"],
            "#datalist-TechProjects option": ["missing-project", "owned-project"]
        },
        ["owned-deco", "owned-project"]
    );
    await context.addMissingVaultItems("VaultShipDecorations");
    await context.bulkRemoveVaultItems("VaultShipDecorations");
    await context.addMissingTechProjects();
    await context.bulkRemoveTechProjects();
    assert.deepEqual(
        requests.map(request => [request.url, JSON.parse(request.data)]),
        [
            [
                "/custom/addVaultTypeCount?auth=token&guildId=guild-one",
                { vaultType: "VaultShipDecorations", items: [{ ItemType: "missing-deco", ItemCount: 999999 }] }
            ],
            [
                "/custom/addVaultTypeCount?auth=token&guildId=guild-one",
                { vaultType: "VaultShipDecorations", items: [{ ItemType: "owned-deco", ItemCount: -999999 }] }
            ],
            ["/custom/addTechProject?auth=token&guildId=guild-one", [{ ItemType: "missing-project" }]],
            ["/custom/removeTechProject?auth=token&guildId=guild-one", [{ ItemType: "owned-project" }]]
        ]
    );
    assert.deepEqual(confirmations, [
        "code_addVaultItemsConfirm:1",
        "code_removeVaultItemsConfirm:1",
        "code_addTechProjectsConfirm:1",
        "code_removeTechProjectsConfirm:1"
    ]);
    assert.equal(reloads(), 4);
});

void test("failed or cancelled clan edits do not clear inputs or reload the page", async () => {
    const { context, requests, reloads } = loadGuildModules();
    const { elements } = attachGuildFormDom(context, { "#datalist-TechProjects option": ["project"] });
    elements.set("acquire-type-TechProjects", { key: "project", value: "project" });
    context.$.post = options => {
        requests.push(options);
        return { done() {} };
    };
    context.addGuildTechProject();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get("acquire-type-TechProjects").value, "project");
    context.confirm = () => false;
    assert.equal(context.addMissingTechProjects(), undefined);
    assert.equal(requests.length, 1);
    assert.equal(reloads(), 0);
});

void test("clan overview preserves rank permissions and clears the guest view", () => {
    const { context } = loadGuildModules();
    const elements = new Map();
    const rowClasses = new Set();
    const cheatInput = { id: "HasGuildRichStuff", checked: false, disabled: false };
    const element = id => {
        if (!elements.has(id)) {
            const classes = new Set();
            elements.set(id, {
                classList: {
                    add: name => classes.add(name),
                    remove: name => classes.delete(name),
                    contains: name => classes.has(name)
                },
                value: "",
                textContent: "",
                innerHTML: ""
            });
        }
        return elements.get(id);
    };
    context.document = {
        getElementById: element,
        querySelectorAll: selector => (selector === "#guild-cheats input[id]" ? [cheatInput] : [])
    };
    const ajax = context.$;
    context.$ = () => ({
        addClass: name => rowClasses.add(name),
        removeClass: name => rowClasses.delete(name)
    });
    context.$.get = ajax.get;
    context.$.post = ajax.post;
    context.normalizeText = text => text;
    context.loc = key => (key === "guildView_currency_owned" ? "Owned |COUNT|" : key);
    context.accountId = "owner";
    const guild = {
        Name: "Test Clan",
        Tier: 1,
        Class: "Moon",
        VaultRegularCredits: 1234,
        Members: [{ _id: { $oid: "owner" }, Rank: 0 }],
        Ranks: [{ Permissions: 128 | 16 | 64 }],
        HasGuildRichStuff: true
    };
    const itemMap = {
        "/Lotus/Language/Clan/Clan_TierDisplay": { name: "Tier |TIER|" },
        "/Lotus/Language/Clan/Clan_Tier1": { name: "One" },
        "/Lotus/Language/Clan/Clan_ClassLower": { name: "Class |CLASS|" }
    };
    context.guildPage.clearView();
    assert.equal(rowClasses.has("d-none"), true);
    const permissions = context.guildPage.renderOverview(guild, itemMap);
    assert.equal(permissions.userGuildMember.Rank, 0);
    assert.equal(permissions.userGuildPermissions, 208);
    assert.equal(element("guildView-title").textContent, "Test Clan");
    assert.equal(element("guildView-tier").textContent, "Tier One");
    assert.equal(element("guildView-class").textContent, "Class Moon");
    assert.equal(element("VaultRegularCredits-owned").textContent, `Owned ${(1234).toLocaleString()}`);
    assert.equal(element("vaultRegularCredits-form").classList.contains("d-none"), false);
    assert.equal(element("techProjects-form").classList.contains("d-none"), false);
    assert.equal(element("TechProjects-bulkFund").classList.contains("d-none"), false);
    assert.equal(rowClasses.has("d-none"), false);
    assert.equal(cheatInput.checked, true);
    assert.equal(cheatInput.disabled, false);

    context.accountId = "guest";
    context.guildPage.clearView();
    const guest = context.guildPage.renderOverview(guild, itemMap);
    assert.equal(guest.userGuildMember, undefined);
    assert.equal(guest.userGuildPermissions, undefined);
    assert.equal(element("vaultRegularCredits-form").classList.contains("d-none"), true);
    assert.equal(element("techProjects-form").classList.contains("d-none"), true);
    assert.equal(element("TechProjects-bulkFund").classList.contains("d-none"), true);
    assert.equal(cheatInput.disabled, true);
});

void test("clan route renders research, vault, members, and alliance actions", async () => {
    const { context, routeHandlers, requests, setGuildData, setAllianceData } = loadGuildModules();
    const { get, debounced } = attachGuildRouteDom(context);
    context.accountId = "owner";
    const guild = {
        _id: "guild-one",
        Name: "Test Clan",
        Tier: 1,
        Class: "Moon",
        AllianceId: "alliance",
        TechProjects: [
            { ItemType: "tech", State: 0 },
            { ItemType: "running", State: 1, CompletionDate: new Date(Date.now() + 86400000).toISOString() }
        ],
        VaultDecoRecipes: [{ ItemType: "deco", ItemCount: 1 }],
        VaultMiscItems: [{ ItemType: "ore", ItemCount: 2 }],
        VaultShipDecorations: [],
        Members: [
            { _id: { $oid: "owner" }, DisplayName: "Owner", Rank: 0, Status: 0 },
            { _id: { $oid: "junior" }, DisplayName: "Junior", Rank: 4, Status: 1 }
        ],
        Ranks: [
            { Name: "rank-owner", Permissions: 128 | 64 | 16 | 8 | 4 },
            null,
            null,
            null,
            { Name: "rank-junior", Permissions: 0 }
        ]
    };
    const itemMap = {
        "/Lotus/Language/Clan/Clan_TierDisplay": { name: "Tier |TIER|" },
        "/Lotus/Language/Clan/Clan_Tier1": { name: "One" },
        "/Lotus/Language/Clan/Clan_ClassLower": { name: "Class |CLASS|" },
        "/Lotus/Language/Menu/SocialOverlay_Promote": { name: "Promote" },
        "/Lotus/Language/Menu/SocialOverlay_Demote": { name: "Demote" },
        "/Lotus/Language/Clan/Clan_AllianceBtnTitle": { name: "Alliance" },
        "/Lotus/Language/Menu/SocialOverlay_PendingLabel": { name: "Pending" },
        tech: { name: "Research" },
        ore: { name: "Ore" },
        deco: { name: "Decoration" },
        "rank-owner": { name: "Founder" },
        "rank-junior": { name: "Member" }
    };
    setGuildData(guild);
    setAllianceData({
        Name: "Alliance One",
        Clans: [
            { _id: { $oid: "guild-one" }, Name: "Test Clan", Permissions: 1 },
            { _id: { $oid: "other" }, Name: "Other Clan", Permissions: 0, Pending: true }
        ]
    });
    context.itemListPromise = Promise.resolve(itemMap);
    assert.equal(typeof routeHandlers.get("beforeload"), "function");
    routeHandlers.get("beforeload")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(get("guildView-title").textContent, "Test Clan");
    assert.equal(get("TechProjects-list").children.length, 2);
    assert.equal(get("TechProjects-list").children[0].children[1].children.length, 2);
    assert.equal(get("VaultDecoRecipes-list").children[0].children[1].children.length, 1);
    assert.equal(get("VaultMiscItems-list").children[0].children[1].children.length, 1);
    assert.equal(get("Members-list").children[1].children[1].children.length, 3);
    assert.equal(get("Alliance-list").children[1].children[1].children.length, 1);
    assert.equal(get("guildView-alliance").textContent, "Alliance: Alliance One");
    assert.equal(requests.filter(request => request.url === "/custom/getAlliance?guildId=guild-one").length, 1);
    const click = get("TechProjects-list").children[0].children[1].children[0];
    let prevented = false;
    click.onclick({
        preventDefault: () => {
            prevented = true;
        }
    });
    assert.equal(prevented, true);
    assert.deepEqual(debounced, [["fundGuildTechProject", "tech"]]);
});

void test("clan route shows empty state without loading member or alliance lists", async () => {
    const { context, routeHandlers, setGuildData, requests } = loadGuildModules();
    const { get } = attachGuildRouteDom(context);
    setGuildData(null);
    routeHandlers.get("beforeload")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(get("guildView-loading").classList.contains("d-none"), true);
    assert.equal(get("guildView-na").classList.contains("d-none"), false);
    assert.equal(get("Members-list").children.length, 0);
    assert.equal(requests.length, 1);
});

void test("guest guild lists never expose research, vault, or alliance actions", async () => {
    const { context, setAllianceData } = loadGuildModules();
    const { get } = attachGuildRouteDom(context);
    const guild = {
        AllianceId: "alliance",
        TechProjects: [{ ItemType: "tech", State: 0 }],
        VaultDecoRecipes: [{ ItemType: "deco", ItemCount: 1 }],
        VaultMiscItems: [{ ItemType: "ore", ItemCount: 1 }],
        VaultShipDecorations: [],
        Members: [{ _id: { $oid: "owner" }, Rank: 0, DisplayName: "Owner", Status: 0 }],
        Ranks: [{ Name: "ownerRank", Permissions: 128 | 64 }]
    };
    setAllianceData({ Name: "Alliance", Clans: [{ _id: { $oid: "other" }, Name: "Other", Permissions: 0 }] });
    const itemMap = {
        ownerRank: { name: "Founder" },
        "/Lotus/Language/Clan/Clan_AllianceBtnTitle": { name: "Alliance" }
    };
    context.guildPage.renderInventoryLists(guild, itemMap, undefined, undefined);
    context.guildPage.renderMembers(guild, itemMap, undefined, undefined);
    context.guildPage.renderAlliance(guild, itemMap, undefined);
    await new Promise(resolve => setImmediate(resolve));
    for (const id of [
        "TechProjects-list",
        "VaultDecoRecipes-list",
        "VaultMiscItems-list",
        "Members-list",
        "Alliance-list"
    ]) {
        assert.equal(get(id).children[0].children[1].children.length, 0, id);
    }
});

void test("clan headers keep localized bulk buttons and actions", async () => {
    const { context, initializeHeaders } = loadGuildModules();
    const { headers, debounced } = attachGuildRouteDom(context);
    initializeHeaders();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(
        headers[0].children[1].children.map(button => button.id),
        ["TechProjects-bulkAdd", "TechProjects-bulkFund", "TechProjects-bulkComplete", "TechProjects-bulkRemove"]
    );
    assert.equal(headers[0].children[0].getAttribute("data-loc"), "guildView_techProjects");
    assert.deepEqual(
        headers[1].children[1].children.map(button => button.id),
        ["VaultMiscItems-bulkRemove"]
    );
    assert.equal(headers[0].children[1].children[1].getAttribute("data-loc-title"), "guildView_bulkFund");
    headers[0].children[1].children[1].onclick({ preventDefault() {} });
    assert.deepEqual(debounced, [["fundAllTechProjects"]]);
});

void test("clan cheat change preserves retroactive request after confirmation", async () => {
    const cheat = { id: "HasGuildRichStuff", checked: true };
    const { context, requests, setCheatResponse } = loadGuildModules({
        querySelectorAll: selector => (selector === "#guild-cheats input[type=checkbox]" ? [cheat] : [])
    });
    context.loc = key => key;
    context.confirm = () => true;
    setCheatResponse("retroactivable");
    cheat.onchange();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests[0].url, "/custom/setGuildCheat?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[0].data), { key: "HasGuildRichStuff", value: true });
    assert.equal(
        requests[1].url,
        "/custom/retroactivelyApplyGuildCheat?auth=token&guildId=guild-one&cheat=HasGuildRichStuff"
    );
});
