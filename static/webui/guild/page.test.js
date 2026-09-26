import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadGuildModules() {
    const requests = [];
    const subscriptions = [];
    let guildId = "guild-one";
    let guildData = { _id: guildId };
    let reloads = 0;
    const context = {
        authz: "auth=token",
        subscribedToGuildId: undefined,
        ws: { send: message => subscriptions.push(JSON.parse(message)) },
        $: {
            get(url) {
                requests.push({ method: "GET", url });
                return Promise.resolve(url.startsWith("/custom/getGuild?") ? guildData : undefined);
            },
            post(options) {
                requests.push({ method: "POST", ...options });
                return Promise.resolve();
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

void test("guild vault, project, and currency requests retain their payloads", async () => {
    const { context, requests } = loadGuildModules();
    await context.guildApi.addVaultItem("guild-one", "VaultMiscItems", [{ ItemType: "item", ItemCount: -2 }]);
    await context.guildApi.techProject("fund", "guild-one", [{ ItemType: "project" }]);
    await context.guildApi.addCurrency("guild-one", "VaultRegularCredits", 10);
    assert.equal(requests[0].url, "/custom/addVaultTypeCount?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[0].data), {
        vaultType: "VaultMiscItems",
        items: [{ ItemType: "item", ItemCount: -2 }]
    });
    assert.equal(requests[1].url, "/custom/fundTechProject?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[1].data), [{ ItemType: "project" }]);
    assert.equal(requests[2].url, "/custom/addCurrency?auth=token&guildId=guild-one");
    assert.deepEqual(JSON.parse(requests[2].data), { currency: "VaultRegularCredits", delta: 10 });
});

void test("bulk project actions select only fundable and incomplete research", async () => {
    const { context, setProjects } = loadGuildModules();
    const actions = [];
    context.dispatchFundTechProjectsBatch = requests => actions.push(["fund", JSON.parse(JSON.stringify(requests))]);
    context.dispatchCompleteTechProjectsBatch = requests =>
        actions.push(["complete", JSON.parse(JSON.stringify(requests))]);
    setProjects([
        { ItemType: "unfunded", State: 0 },
        { ItemType: "running", State: 1, CompletionDate: new Date(Date.now() + 86400000).toISOString() },
        { ItemType: "finished", State: 1, CompletionDate: new Date(Date.now() - 86400000).toISOString() }
    ]);
    context.fundAllTechProjects();
    context.completeAllTechProjects();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(actions, [
        ["fund", [{ ItemType: "unfunded" }]],
        ["complete", [{ ItemType: "running" }]]
    ]);
});
