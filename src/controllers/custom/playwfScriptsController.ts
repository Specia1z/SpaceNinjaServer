import type { RequestHandler } from "express";
import { Account } from "../../models/loginModel.ts";
import { config, type IPlaywfContentMod } from "../../services/configService.ts";
import { saveConfig } from "../../services/configWriterService.ts";
import {
    getPlaywfAccountScriptEditorEntries,
    getPlaywfContentConfig,
    getPlaywfScriptEditorEntries,
    getPlaywfServerScriptPath,
    getPlaywfServerScriptSourcePath,
    getPlaywfServerScriptsState,
    removePlaywfServerScriptFiles,
    writePlaywfServerScriptFiles,
    type IPlaywfScriptEditorEntry
} from "../../services/playwfContentService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { getTunablesForClient } from "../../services/tunablesService.ts";
import { forEachWsClient, sendWsBroadcastEx } from "../../services/wsService.ts";

const MAX_SCRIPTS = 128;
const MAX_NAME_LENGTH = 128;
const MAX_SOURCE_LENGTH = 1024 * 1024;
const MAX_TOTAL_SOURCE_LENGTH = 8 * 1024 * 1024;
const MAX_ACCOUNT_SCRIPT_ENTRIES = 5000;
const MAX_ACCOUNT_BLACKLIST_ENTRIES = 5000;
const scriptNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface ISourceBudget {
    bytes: number;
}

interface IPlaywfScriptsResponse {
    scripts: IPlaywfScriptEditorEntry[];
    accountScripts: Partial<Record<string, IPlaywfScriptEditorEntry[]>>;
    accountBlacklist: string[];
    accounts: {
        id: string;
        displayName: string;
        scriptCount: number;
        blacklisted: boolean;
    }[];
    selectedAccountId: string;
    revision: string;
}

const getSelectedAccountId = (req: Parameters<RequestHandler>[0]): string | undefined =>
    typeof req.query.selectedAccountId == "string" ? req.query.selectedAccountId : undefined;

const getResponse = async (selectedAccountId?: string): Promise<IPlaywfScriptsResponse> => {
    const content = getPlaywfContentConfig();
    const accountScripts = getPlaywfAccountScriptEditorEntries();
    const accountBlacklist = content?.accountBlacklist ?? [];
    const configuredAccountMods = content?.accountMods ?? {};
    const accounts = (await Account.find({}, "DisplayName").sort({ DisplayName: 1 })).map(account => {
        const id = account._id.toString();
        return {
            id,
            displayName: account.DisplayName,
            scriptCount: accountScripts[id]?.length ?? configuredAccountMods[id]?.length ?? 0,
            blacklisted: accountBlacklist.includes(id)
        };
    });
    return {
        scripts: getPlaywfScriptEditorEntries(),
        accountScripts,
        accountBlacklist,
        accounts,
        selectedAccountId: selectedAccountId ?? "",
        revision: getPlaywfServerScriptsState(selectedAccountId).revision
    };
};

const getSourceBudgetError = (): Error =>
    new Error(`All Pluto scripts together must be at most ${MAX_TOTAL_SOURCE_LENGTH} bytes`);

export const parsePlaywfScripts = (
    value: unknown,
    label = "scripts",
    budget: ISourceBudget = { bytes: 0 }
): IPlaywfScriptEditorEntry[] => {
    if (!Array.isArray(value) || value.length > MAX_SCRIPTS) {
        throw new Error(`${label} must be an array with at most ${MAX_SCRIPTS} entries`);
    }

    const names = new Set<string>();
    return value.map((raw, index) => {
        if (!raw || typeof raw != "object" || Array.isArray(raw)) {
            throw new Error(`${label} entry ${index + 1} must be an object`);
        }
        const input = raw as Record<string, unknown>;
        if (typeof input.name != "string") {
            throw new Error(`${label} entry ${index + 1} name must be a string`);
        }
        const name = input.name.trim();
        if (!name || name.length > MAX_NAME_LENGTH || !scriptNamePattern.test(name)) {
            throw new Error(
                `${label} entry ${index + 1} name must contain only letters, numbers, dots, underscores, or hyphens`
            );
        }
        if (names.has(name)) {
            throw new Error(`${label} contains duplicate script name ${name}`);
        }
        names.add(name);

        if (typeof input.source != "string") {
            throw new Error(`${label} script ${name} source must be a string`);
        }
        const source = input.source.replaceAll("\r", "");
        const sourceByteLength = Buffer.byteLength(source, "utf8");
        if (!source.trim()) {
            throw new Error(`${label} script ${name} source must not be empty`);
        }
        if (source.includes("\0") || sourceByteLength > MAX_SOURCE_LENGTH) {
            throw new Error(`${label} script ${name} source is too long`);
        }
        budget.bytes += sourceByteLength;
        if (budget.bytes > MAX_TOTAL_SOURCE_LENGTH) {
            throw getSourceBudgetError();
        }
        if (input.enabled !== undefined && typeof input.enabled != "boolean") {
            throw new Error(`${label} script ${name} enabled must be a boolean`);
        }
        return {
            name,
            source,
            enabled: input.enabled !== false
        };
    });
};

const isSafeAccountId = (accountId: string): boolean =>
    accountId.length > 0 && accountId.length <= 100 && scriptNamePattern.test(accountId);

export const parsePlaywfAccountScripts = (
    value: unknown,
    globalBudget: ISourceBudget = { bytes: 0 }
): Partial<Record<string, IPlaywfScriptEditorEntry[]>> => {
    if (!value || typeof value != "object" || Array.isArray(value)) {
        throw new Error("accountScripts must be an object");
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_ACCOUNT_SCRIPT_ENTRIES) {
        throw new Error(`accountScripts must contain at most ${MAX_ACCOUNT_SCRIPT_ENTRIES} accounts`);
    }
    return Object.fromEntries(
        entries.map(([accountId, scripts]) => {
            if (!isSafeAccountId(accountId)) {
                throw new Error("Each accountScripts key must be a non-empty safe account ID");
            }
            return [
                accountId,
                parsePlaywfScripts(scripts, `accountScripts.${accountId}`, { bytes: globalBudget.bytes })
            ];
        })
    );
};

export const parsePlaywfScriptBlacklist = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length > MAX_ACCOUNT_BLACKLIST_ENTRIES) {
        throw new Error(`accountBlacklist must be an array with at most ${MAX_ACCOUNT_BLACKLIST_ENTRIES} account IDs`);
    }
    const accountIds = value.map((accountId, index) => {
        if (typeof accountId != "string" || !isSafeAccountId(accountId)) {
            throw new Error(`accountBlacklist entry ${index + 1} must be a non-empty safe account ID`);
        }
        return accountId;
    });
    return [...new Set(accountIds)];
};

const toContentMod = (script: IPlaywfScriptEditorEntry, accountId?: string): IPlaywfContentMod => ({
    id: accountId === undefined ? `server/${script.name}` : `account/${accountId}/${script.name}`,
    version: 1,
    scriptPath: getPlaywfServerScriptPath(script.name, accountId),
    sourcePath: getPlaywfServerScriptSourcePath(script.name, accountId),
    enabled: script.enabled,
    autoStart: true
});

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
    res.json(await getResponse(getSelectedAccountId(req)));
};

export const savePlaywfScriptsController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }

    try {
        const body = req.body as Record<string, unknown>;
        const budget: ISourceBudget = { bytes: 0 };
        const scripts = parsePlaywfScripts(body.scripts, "scripts", budget);
        const accountScripts =
            body.accountScripts === undefined
                ? getPlaywfAccountScriptEditorEntries()
                : parsePlaywfAccountScripts(body.accountScripts, budget);
        const accountBlacklist =
            body.accountBlacklist === undefined
                ? (getPlaywfContentConfig()?.accountBlacklist ?? [])
                : parsePlaywfScriptBlacklist(body.accountBlacklist);
        const staleSourcePaths = await writePlaywfServerScriptFiles(scripts, accountScripts);
        config.tunables ??= {};
        config.tunables.playwfContent = {
            schemaVersion: 1,
            namespace: "/PlayWF",
            revision: "",
            mods: scripts.map(script => toContentMod(script)),
            accountMods: Object.fromEntries(
                Object.entries(accountScripts).map(([accountId, entries]) => [
                    accountId,
                    (entries ?? []).map(script => toContentMod(script, accountId))
                ])
            ),
            accountBlacklist
        };
        config.tunables.playwfContent.revision = getPlaywfServerScriptsState().revision;
        await saveConfig();
        await removePlaywfServerScriptFiles(staleSourcePaths);
        broadcastTunables();
        sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
        res.json(await getResponse(getSelectedAccountId(req)));
    } catch (error) {
        res.status(400).send((error as Error).message);
    }
};
