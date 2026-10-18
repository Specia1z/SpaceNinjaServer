import assert from "node:assert/strict";
import fsPromises from "node:fs/promises";
import { after, before, test } from "node:test";
import path from "node:path";
import { config } from "./configService.ts";
import {
    getPlaywfAutoStartScripts,
    getPlaywfContentConfig,
    getPlaywfScript,
    getPlaywfScriptEditorEntries,
    getPlaywfServerScriptSourcePath,
    getPlaywfServerScriptsState,
    removePlaywfServerScriptFiles,
    serverScriptDirectory,
    writePlaywfServerScriptFiles
} from "./playwfContentService.ts";

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

void test("builds an in-memory server script payload without disabled scripts", () => {
    assert.deepEqual(getPlaywfScriptEditorEntries(), [
        {
            name: "test",
            source: "print('hello')",
            enabled: true
        },
        {
            name: "disabled",
            source: "print('disabled')",
            enabled: false
        }
    ]);
    const state = getPlaywfServerScriptsState();
    assert.deepEqual(JSON.parse(state.payload), [{ path: "/PlayWF/test.pluto", source: "print('hello')" }]);
    assert.notEqual(state.revision, "");
});

void test("stores server scripts in managed files and removes stale files", async () => {
    const previousContent = config.tunables?.playwfContent;
    const nextName = `file-backed-${process.pid}`;
    const staleName = `stale-${process.pid}`;
    const nextSourcePath = getPlaywfServerScriptSourcePath(nextName);
    const staleSourcePath = getPlaywfServerScriptSourcePath(staleName);
    const nextFilePath = path.join(serverScriptDirectory, `${nextName}.pluto`);
    const staleFilePath = path.join(serverScriptDirectory, `${staleName}.pluto`);

    try {
        await fsPromises.mkdir(serverScriptDirectory, { recursive: true });
        await fsPromises.writeFile(staleFilePath, "print('stale')", "utf8");
        config.tunables!.playwfContent = {
            schemaVersion: 1,
            namespace: "/PlayWF",
            revision: "",
            mods: [
                {
                    scriptPath: `/PlayWF/${staleName}.pluto`,
                    sourcePath: staleSourcePath,
                    enabled: true
                }
            ]
        };

        assert.deepEqual(
            await writePlaywfServerScriptFiles([
                {
                    name: nextName,
                    source: "print('file-backed')",
                    enabled: true
                }
            ]),
            [staleSourcePath]
        );
        assert.equal(await fsPromises.readFile(nextFilePath, "utf8"), "print('file-backed')");

        config.tunables!.playwfContent.mods = [
            {
                scriptPath: `/PlayWF/${nextName}.pluto`,
                sourcePath: nextSourcePath,
                enabled: true
            }
        ];
        assert.deepEqual(getPlaywfScript(`/PlayWF/${nextName}.pluto`), {
            path: `/PlayWF/${nextName}.pluto`,
            source: "print('file-backed')"
        });
        assert.deepEqual(getPlaywfScriptEditorEntries(), [
            {
                name: nextName,
                source: "print('file-backed')",
                enabled: true
            }
        ]);
        assert.deepEqual(JSON.parse(getPlaywfServerScriptsState().payload), [
            {
                path: `/PlayWF/${nextName}.pluto`,
                source: "print('file-backed')"
            }
        ]);

        await removePlaywfServerScriptFiles([staleSourcePath]);
        await assert.rejects(fsPromises.access(staleFilePath));
    } finally {
        config.tunables!.playwfContent = previousContent;
        await fsPromises.rm(nextFilePath, { force: true });
        await fsPromises.rm(staleFilePath, { force: true });
    }
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
