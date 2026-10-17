import type { RequestHandler } from "express";
import { config } from "../../services/configService.ts";
import { saveConfig } from "../../services/configWriterService.ts";
import {
    getPlaywfScriptEditorEntries,
    getPlaywfServerScriptsState,
    type IPlaywfScriptEditorEntry
} from "../../services/playwfContentService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { getTunablesForClient } from "../../services/tunablesService.ts";
import { forEachWsClient, sendWsBroadcastEx } from "../../services/wsService.ts";

const MAX_SCRIPTS = 128;
const MAX_NAME_LENGTH = 128;
const MAX_SOURCE_LENGTH = 1024 * 1024;
const MAX_TOTAL_SOURCE_LENGTH = 8 * 1024 * 1024;
const scriptNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const getResponse = (): { scripts: IPlaywfScriptEditorEntry[]; revision: string } => {
    const state = getPlaywfServerScriptsState();
    return {
        scripts: getPlaywfScriptEditorEntries(),
        revision: state.revision
    };
};

const parseScripts = (value: unknown): IPlaywfScriptEditorEntry[] => {
    if (!Array.isArray(value) || value.length > MAX_SCRIPTS) {
        throw new Error(`scripts must be an array with at most ${MAX_SCRIPTS} entries`);
    }

    const names = new Set<string>();
    let totalSourceLength = 0;
    return value.map((raw, index) => {
        if (!raw || typeof raw != "object" || Array.isArray(raw)) {
            throw new Error(`Script ${index + 1} must be an object`);
        }
        const input = raw as Record<string, unknown>;
        if (typeof input.name != "string") {
            throw new Error(`Script ${index + 1} name must be a string`);
        }
        const name = input.name.trim();
        if (!name || name.length > MAX_NAME_LENGTH || !scriptNamePattern.test(name)) {
            throw new Error(`Script ${index + 1} name must contain only letters, numbers, dots, underscores, or hyphens`);
        }
        if (names.has(name)) {
            throw new Error(`Script name ${name} is duplicated`);
        }
        names.add(name);

        if (typeof input.source != "string") {
            throw new Error(`Script ${name} source must be a string`);
        }
        const source = input.source.replaceAll("\r", "");
        const sourceByteLength = Buffer.byteLength(source, "utf8");
        if (!source.trim()) {
            throw new Error(`Script ${name} source must not be empty`);
        }
        if (source.includes("\0") || sourceByteLength > MAX_SOURCE_LENGTH) {
            throw new Error(`Script ${name} source is too long`);
        }
        totalSourceLength += sourceByteLength;
        if (totalSourceLength > MAX_TOTAL_SOURCE_LENGTH) {
            throw new Error(`All Pluto scripts together must be at most ${MAX_TOTAL_SOURCE_LENGTH} bytes`);
        }
        if (input.enabled !== undefined && typeof input.enabled != "boolean") {
            throw new Error(`Script ${name} enabled must be a boolean`);
        }
        return {
            name,
            source,
            enabled: input.enabled !== false
        };
    });
};

const broadcastTunables = (): void => {
    forEachWsClient(client => {
        if (client.isGame) {
            client.send(
                JSON.stringify({
                    tunables: getTunablesForClient(client.address, client.reflexiveAddress, client.accountId)
                })
            );
        }
    });
};

export const getPlaywfScriptsController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }
    res.json(getResponse());
};

export const savePlaywfScriptsController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }

    try {
        const body = req.body as Record<string, unknown>;
        const scripts = parseScripts(body.scripts);
        config.tunables ??= {};
        config.tunables.playwfContent = {
            schemaVersion: 1,
            namespace: "/PlayWF",
            revision: "",
            mods: scripts.map(script => ({
                id: `server/${script.name}`,
                version: 1,
                scriptPath: `/PlayWF/${script.name}.pluto`,
                script: script.source,
                enabled: script.enabled,
                autoStart: true
            }))
        };
        config.tunables.playwfContent.revision = getPlaywfServerScriptsState().revision;
        await saveConfig();
        broadcastTunables();
        sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
        res.json(getResponse());
    } catch (error) {
        res.status(400).send((error as Error).message);
    }
};
