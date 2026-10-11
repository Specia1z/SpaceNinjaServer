import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { config } from "./configService.ts";
import { getPlaywfAutoStartScripts, getPlaywfContentConfig, getPlaywfScript } from "./playwfContentService.ts";

const previousTunables = config.tunables;

before(() => {
    config.tunables = {
        playwfContent: {
            schemaVersion: 1,
            namespace: "/PlayWF",
            revision: "test",
            mods: [
                {
                    id: "test/inline",
                    version: 1,
                    scriptPath: "/PlayWF/test.pluto",
                    script: "print('hello')",
                    autoStart: true
                },
                {
                    id: "test/disabled",
                    scriptPath: "/PlayWF/disabled.pluto",
                    script: "print('disabled')",
                    enabled: false
                }
            ]
        }
    };
});

after(() => {
    config.tunables = previousTunables;
});

void test("normalizes configured Pluto content and exposes only enabled scripts", () => {
    assert.equal(getPlaywfContentConfig()?.revision, "test");
    assert.deepEqual(getPlaywfAutoStartScripts(), ["/PlayWF/test.pluto"]);
    assert.deepEqual(getPlaywfScript("/PlayWF/test.pluto"), {
        path: "/PlayWF/test.pluto",
        source: "print('hello')"
    });
    assert.equal(getPlaywfScript("/PlayWF/disabled.pluto"), undefined);
});

void test("prohibitScripts suppresses configured Pluto auto-start scripts", () => {
    config.tunables!.prohibitScripts = true;
    assert.deepEqual(getPlaywfAutoStartScripts(), []);
    config.tunables!.prohibitScripts = false;
});

void test("rejects unsafe and non-Pluto script paths", () => {
    config.tunables!.playwfContent!.mods!.push(
        { scriptPath: "/PlayWF/../secret.pluto", script: "secret" },
        { scriptPath: "/PlayWF/not-a-script.txt", script: "wrong" }
    );
    assert.equal(getPlaywfScript("/PlayWF/../secret.pluto"), undefined);
    assert.equal(getPlaywfScript("/PlayWF/not-a-script.txt"), undefined);
});
