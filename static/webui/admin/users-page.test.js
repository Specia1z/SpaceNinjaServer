import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function makeElement(id = "") {
    const listeners = new Map();
    const classes = new Set();
    const element = {
        id,
        children: [],
        dataset: {},
        attributes: {},
        value: "",
        textContent: "",
        innerHTML: "",
        className: "",
        disabled: false,
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
            toggle(name, force) {
                const shouldAdd = force ?? !classes.has(name);
                if (shouldAdd) classes.add(name);
                else classes.delete(name);
                return shouldAdd;
            }
        },
        addEventListener(type, callback) {
            const callbacks = listeners.get(type) ?? [];
            callbacks.push(callback);
            listeners.set(type, callbacks);
        },
        dispatch(type, event = {}) {
            for (const callback of listeners.get(type) ?? []) callback({ preventDefault() {}, ...event });
        },
        append(...children) {
            this.children.push(...children);
        },
        replaceChildren(...children) {
            this.children = [...children];
        },
        insertCell() {
            const cell = makeElement();
            this.children.push(cell);
            return cell;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        focus() {}
    };
    return element;
}

function loadUsersPage() {
    const selectors = [
        "#admin-users-search",
        "#registered-losers",
        "#admin-users-total",
        "#admin-users-admin-count",
        "#admin-users-banned-count",
        "#admin-users-visible-count",
        "#admin-users-empty",
        "#admin-users-clear-search",
        "#admin-users-refresh",
        "#admin-broadcast-form",
        "#admin-message-sender",
        "#admin-message-subject",
        "#admin-message-body",
        "#admin-message-target",
        "#admin-message-counted-att",
        "#admin-broadcast-submit",
        "#admin-message-att",
        "#admin-message-high-priority",
        "#admin-message-icon",
        "#admin-irc-notice",
        "#admin-irc-message",
        "#admin-irc-submit",
        "#admin-irc-byte-count",
        "#admin-irc-form"
    ];
    const elements = new Map(selectors.map(selector => [selector, makeElement(selector.slice(1))]));
    const denied = makeElement("admin-denied");
    const admin = makeElement("admin-content");
    elements.get("#admin-message-sender").value = "/Lotus/Language/Bosses/Ordis";
    elements.get("#admin-message-high-priority").checked = true;

    const handlers = new Map();
    const users = [
        { id: "account-1", DisplayName: "<img src=x>", Banned: true, IsAdministrator: false },
        { id: "account-2", DisplayName: "Operator", Banned: false, IsAdministrator: true },
        { id: "account-3", DisplayName: "Regular", Banned: false, IsAdministrator: false }
    ];
    const apiCalls = [];
    const messages = [];
    const toasts = [];
    const context = {
        accountId: "account-2",
        document: {
            getElementById: id => (id === "users-route" ? root : datalist),
            createElement: tag => makeElement(tag)
        },
        TextEncoder,
        single: {
            getRoute: () => ({ on: (event, handler) => handlers.set(event, handler) }),
            getCurrentPath: () => "/webui/users",
            loadRoute() {}
        },
        adminUsersApi: {
            list: async () => users,
            broadcastInbox: async payload => messages.push(payload),
            announceIrc: async message => apiCalls.push(["announceIrc", message])
        },
        suspicionApi: { ban: async (...args) => apiCalls.push(["ban", ...args]) },
        webuiComponents: { confirm: async () => true },
        awaitAuthz: async () => {},
        revalidateAuthz: async () => {},
        loc: key => key,
        replacePluralForms: (text, { COUNT }) => text.replace("|COUNT|", String(COUNT)),
        toast: (...args) => toasts.push(args),
        doAccountSwitch() {},
        localStorage: { setItem() {} },
        ws_is_open: false,
        auth_pending: false,
        console
    };
    context.window = context;
    const root = {
        querySelector: selector => elements.get(selector),
        querySelectorAll(selector) {
            if (selector === ".admin-hide") return [denied];
            if (selector === ".admin-show") return [admin];
            return [];
        }
    };
    const datalist = makeElement("datalist-usernames");
    vm.runInNewContext(readFileSync(new URL("users-page.js", import.meta.url), "utf8"), context, {
        filename: "users-page.js"
    });

    return { context, elements, handlers, users, datalist, denied, admin, apiCalls, messages, toasts };
}

function loadUsersApi() {
    const calls = { get: [], ajax: [], fetch: [] };
    let fetchResponse = { ok: true, status: 200 };
    const context = {
        authz: "auth=token",
        $: {
            get: async url => {
                calls.get.push(url);
                return [{ id: "account-1" }];
            },
            ajax: options => {
                calls.ajax.push(options);
                return Promise.resolve();
            }
        },
        fetch: async (url, options) => {
            calls.fetch.push({ url, options });
            return fetchResponse;
        }
    };
    context.window = context;
    vm.runInNewContext(readFileSync(new URL("users-api.js", import.meta.url), "utf8"), context, {
        filename: "users-api.js"
    });
    return {
        api: context.adminUsersApi,
        calls,
        setFetchResponse: response => {
            fetchResponse = response;
        }
    };
}

test("users page loads accounts, summarizes states, and filters safely by name or id", async () => {
    const { elements, handlers, datalist, users } = loadUsersPage();
    await handlers.get("beforeload")();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(elements.get("#admin-users-total").textContent, "3");
    assert.equal(elements.get("#admin-users-admin-count").textContent, "1");
    assert.equal(elements.get("#admin-users-banned-count").textContent, "1");
    assert.equal(elements.get("#registered-losers").children.length, 3);
    assert.equal(datalist.children[0].value, "all");
    assert.deepEqual(
        datalist.children.slice(1).map(option => option.value),
        users.map(user => user.DisplayName)
    );
    assert.equal(elements.get("#registered-losers").children[0].children[0].children[0].textContent, "<img src=x>");

    const search = elements.get("#admin-users-search");
    search.value = "account-3";
    search.dispatch("input");
    assert.equal(elements.get("#registered-losers").children.length, 1);
    assert.equal(elements.get("#registered-losers").children[0].children[0].children[0].textContent, "Regular");
    assert.equal(elements.get("#admin-users-visible-count").textContent, "1");
});

test("users page sends an authorized ban mutation and refreshes the account list", async () => {
    const { elements, handlers, apiCalls } = loadUsersPage();
    await handlers.get("beforeload")();
    await new Promise(resolve => setImmediate(resolve));
    const banButton = elements.get("#registered-losers").children[0].children[3].children[1];
    await banButton.dispatch("click");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(apiCalls, [["ban", "account-1", false]]);
    assert.equal(elements.get("#admin-users-total").textContent, "3");
});

test("users page confirms and sends an inbox broadcast with all attachment fields", async () => {
    const { elements, handlers, messages, toasts } = loadUsersPage();
    await handlers.get("beforeload")();
    await new Promise(resolve => setImmediate(resolve));

    elements.get("#admin-message-sender").value = "Ordis";
    elements.get("#admin-message-subject").value = "Notice";
    elements.get("#admin-message-body").value = "Maintenance soon";
    elements.get("#admin-message-target").value = "all";
    elements.get("#admin-message-target").setAttribute("data-tags-value", "all");
    elements.get("#admin-message-att").value = "item-one\nitem-two";
    elements.get("#admin-message-counted-att").value = '[{"ItemType":"item-three","ItemCount":2}]';
    elements.get("#admin-message-icon").value = "event-icon";
    elements.get("#admin-broadcast-form").dispatch("submit");
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(
        JSON.parse(JSON.stringify(messages)),
        [
            {
                targetIds: ["account-1", "account-2", "account-3"],
                messages: [
                    {
                        sndr: "Ordis",
                        sub: "Notice",
                        msg: "Maintenance soon",
                        highPriority: true,
                        icon: "event-icon",
                        att: ["item-one", "item-two"],
                        countedAtt: [{ ItemType: "item-three", ItemCount: 2 }]
                    }
                ]
            }
        ],
        JSON.stringify(toasts)
    );
});

test("users page validates IRC announcements by UTF-8 byte length and sends valid text", async () => {
    const { elements, handlers, apiCalls } = loadUsersPage();
    await handlers.get("beforeload")();
    await new Promise(resolve => setImmediate(resolve));

    const input = elements.get("#admin-irc-message");
    input.value = "Hi é";
    input.dispatch("input");
    assert.equal(elements.get("#admin-irc-byte-count").textContent, "5 / 400");
    elements.get("#admin-irc-form").dispatch("submit");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(apiCalls, [["announceIrc", "Hi é"]]);
    assert.equal(input.value, "");
    assert.equal(elements.get("#admin-irc-notice").textContent, "admin_ircSent");

    input.value = "🙂".repeat(101);
    elements.get("#admin-irc-form").dispatch("submit");
    assert.equal(apiCalls.length, 1);
    assert.equal(elements.get("#admin-irc-notice").textContent, "admin_ircInvalid");
});

test("users API preserves the users, inbox, and IRC endpoint contracts", async () => {
    const { api, calls, setFetchResponse } = loadUsersApi();
    assert.deepEqual(await api.list(), [{ id: "account-1" }]);
    assert.equal(calls.get[0], "/custom/getRegisteredLosers?auth=token");

    const payload = { targetIds: ["account-1"], messages: [{ sub: "Notice" }] };
    await api.broadcastInbox(payload);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.ajax[0])), {
        url: "/custom/createMessage?auth=token",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify(payload)
    });

    await api.announceIrc("Server maintenance");
    assert.deepEqual(JSON.parse(JSON.stringify(calls.fetch[0])), {
        url: "/custom/admin/irc-announcement?auth=token",
        options: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Server maintenance" })
        }
    });
    setFetchResponse({ ok: false, status: 502 });
    await assert.rejects(api.announceIrc("Unavailable"), error => error.status === 502);
});
