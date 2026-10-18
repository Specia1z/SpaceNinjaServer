import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import { repoDir } from "../helpers/pathHelper.ts";
import { config, type IPlaywfContentConfig, type IPlaywfContentMod } from "./configService.ts";

const defaultNamespace = "/PlayWF";
const scriptPathPattern = /^\/(?:[^/]+\/)*[^/]+\.pluto$/;
const scriptNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const serverScriptDirectory = path.join(repoDir, "static", "data", "playwf-scripts");
const serverScriptSourceDirectory = "static/data/playwf-scripts";
const serverScriptAccountDirectory = "accounts";

interface IResolvedPlaywfScript {
    path: string;
    source: string;
}

export interface IPlaywfScriptEditorEntry {
    name: string;
    source: string;
    enabled: boolean;
}

export interface IPlaywfServerScriptsState {
    scripts: IResolvedPlaywfScript[];
    payload: string;
    revision: string;
}

const assertScriptPathSegment = (value: string, label: string): void => {
    if (!scriptNamePattern.test(value)) throw new Error(`${label} contains unsafe characters`);
};

export const getPlaywfServerScriptSourcePath = (name: string, accountId?: string): string => {
    assertScriptPathSegment(name, "Script name");
    if (accountId === undefined) return path.posix.join(serverScriptSourceDirectory, `${name}.pluto`);
    assertScriptPathSegment(accountId, "Account ID");
    return path.posix.join(serverScriptSourceDirectory, serverScriptAccountDirectory, accountId, `${name}.pluto`);
};

export const getPlaywfServerScriptPath = (name: string, accountId?: string): string => {
    assertScriptPathSegment(name, "Script name");
    if (accountId === undefined) return `/PlayWF/${name}.pluto`;
    assertScriptPathSegment(accountId, "Account ID");
    return `/PlayWF/${serverScriptAccountDirectory}/${accountId}/${name}.pluto`;
};

const getManagedScriptFilePath = (sourcePath: string): string | undefined => {
    const prefix = `${serverScriptSourceDirectory}/`;
    if (sourcePath.includes("\\") || !sourcePath.startsWith(prefix)) return undefined;
    const parts = sourcePath.slice(prefix.length).split("/");
    if (
        (parts.length != 1 && parts.length != 3) ||
        (parts.length == 3 && parts[0] != serverScriptAccountDirectory) ||
        parts.some(part => !scriptNamePattern.test(part)) ||
        !parts.at(-1)!.endsWith(".pluto")
    ) {
        return undefined;
    }
    const filePath = path.resolve(repoDir, sourcePath);
    const relativePath = path.relative(serverScriptDirectory, filePath);
    return relativePath && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath)
        ? filePath
        : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value == "object" && value != null && !Array.isArray(value);

const normalizeContentPath = (value: unknown): string | undefined => {
    if (typeof value != "string" || !value.startsWith("/") || value.includes("\\")) return undefined;
    const normalized = path.posix.normalize(value);
    if (normalized != value || normalized == "/" || normalized.includes("..")) return undefined;
    return normalized;
};

const normalizeNamespace = (value: unknown): string => normalizeContentPath(value) ?? defaultNamespace;

const normalizeMod = (value: unknown): IPlaywfContentMod | undefined => {
    if (!isRecord(value)) return undefined;
    const scriptPath = normalizeContentPath(value.scriptPath);
    if (!scriptPath || !scriptPathPattern.test(scriptPath)) return undefined;
    if (value.enabled !== undefined && typeof value.enabled != "boolean") return undefined;
    if (value.autoStart !== undefined && typeof value.autoStart != "boolean") return undefined;
    if (value.script !== undefined && typeof value.script != "string") return undefined;
    if (value.sourcePath !== undefined && typeof value.sourcePath != "string") return undefined;
    if (typeof value.sourcePath == "string") {
        if (
            path.isAbsolute(value.sourcePath) ||
            value.sourcePath.includes("\\") ||
            value.sourcePath.split("/").some(part => part == "" || part == "." || part == "..")
        ) {
            return undefined;
        }
    }
    return {
        id: typeof value.id == "string" ? value.id : undefined,
        version: typeof value.version == "number" || typeof value.version == "string" ? value.version : undefined,
        displayName: typeof value.displayName == "string" ? value.displayName : undefined,
        description: typeof value.description == "string" ? value.description : undefined,
        metadataPath: typeof value.metadataPath == "string" ? value.metadataPath : undefined,
        scriptPath,
        script: typeof value.script == "string" ? value.script : undefined,
        sourcePath: typeof value.sourcePath == "string" ? value.sourcePath : undefined,
        enabled: value.enabled !== false,
        autoStart: value.autoStart !== false
    };
};

const normalizeMods = (value: unknown): IPlaywfContentMod[] =>
    Array.isArray(value) ? value.map(normalizeMod).filter((mod): mod is IPlaywfContentMod => !!mod) : [];

export const getPlaywfContentConfig = (): IPlaywfContentConfig | undefined => {
    const value: unknown = config.tunables?.playwfContent;
    if (!isRecord(value)) return undefined;
    const rawMods = value.mods;
    const namespace = normalizeNamespace(value.namespace);
    const namespacePrefix = namespace.endsWith("/") ? namespace : `${namespace}/`;
    const filterNamespace = (mods: IPlaywfContentMod[]): IPlaywfContentMod[] =>
        mods.filter(mod => mod.scriptPath!.startsWith(namespacePrefix));
    const accountMods: Partial<Record<string, IPlaywfContentMod[]>> = {};
    if (isRecord(value.accountMods)) {
        for (const [accountId, rawAccountMods] of Object.entries(value.accountMods)) {
            accountMods[accountId] = filterNamespace(normalizeMods(rawAccountMods));
        }
    }
    const accountBlacklist = Array.isArray(value.accountBlacklist)
        ? [...new Set(value.accountBlacklist.filter((accountId): accountId is string => typeof accountId == "string"))]
        : [];
    return {
        schemaVersion: typeof value.schemaVersion == "number" ? value.schemaVersion : 1,
        namespace,
        revision: typeof value.revision == "string" ? value.revision : "",
        mods: filterNamespace(normalizeMods(rawMods)),
        accountMods,
        accountBlacklist
    };
};

const getConfiguredScript = (requestPath: string): IPlaywfContentMod | undefined =>
    getPlaywfContentConfig()?.mods?.find(mod => mod.enabled !== false && mod.scriptPath == requestPath);

const getScriptSource = (mod: IPlaywfContentMod): string | undefined => {
    if (mod.script !== undefined) return mod.script;
    const root = path.resolve(repoDir);
    const relativePaths = mod.sourcePath
        ? [mod.sourcePath]
        : [path.posix.join("static", mod.scriptPath!.slice(1)), mod.scriptPath!.slice(1)];
    for (const relativePath of relativePaths) {
        const filePath = path.resolve(repoDir, relativePath);
        if (filePath == root || !filePath.startsWith(root + path.sep)) continue;
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) return fs.readFileSync(filePath, "utf8");
        } catch {
            // Try the next supported content root.
        }
    }
    return undefined;
};

export const getPlaywfScript = (requestPath: string): IResolvedPlaywfScript | undefined => {
    const mod = getConfiguredScript(requestPath);
    if (!mod) return undefined;
    const source = getScriptSource(mod);
    return source === undefined ? undefined : { path: requestPath, source };
};

const getEditorEntriesForMods = (mods: IPlaywfContentMod[]): IPlaywfScriptEditorEntry[] => {
    return mods
        .map(mod => {
            const source = getScriptSource(mod);
            return source === undefined
                ? undefined
                : {
                      name: path.posix.basename(mod.scriptPath!, ".pluto"),
                      source,
                      enabled: mod.enabled !== false
                  };
        })
        .filter((entry): entry is IPlaywfScriptEditorEntry => !!entry);
};

export const getPlaywfScriptEditorEntries = (): IPlaywfScriptEditorEntry[] =>
    getEditorEntriesForMods(getPlaywfContentConfig()?.mods ?? []);

export const getPlaywfAccountScriptEditorEntries = (): Partial<Record<string, IPlaywfScriptEditorEntry[]>> => {
    const accountMods = getPlaywfContentConfig()?.accountMods ?? {};
    return Object.fromEntries(
        Object.entries(accountMods).map(([accountId, mods]) => [accountId, getEditorEntriesForMods(mods ?? [])])
    );
};

export const getPlaywfServerScriptsState = (accountId?: string): IPlaywfServerScriptsState => {
    const content = getPlaywfContentConfig();
    const mods =
        accountId && (content?.accountBlacklist ?? []).includes(accountId)
            ? []
            : [...(content?.mods ?? []), ...(accountId ? (content?.accountMods?.[accountId] ?? []) : [])];
    const seenPaths = new Set<string>();
    const scripts = mods
        .filter(mod => mod.enabled !== false)
        .map(mod => {
            const source = getScriptSource(mod);
            return source === undefined ? undefined : { path: mod.scriptPath!, source };
        })
        .filter((script): script is IResolvedPlaywfScript => {
            if (!script || seenPaths.has(script.path)) return false;
            seenPaths.add(script.path);
            return true;
        });
    const payload = JSON.stringify(scripts);
    return {
        scripts,
        payload,
        revision: crypto.createHash("sha256").update(payload).digest("hex")
    };
};

export const getPlaywfContentUpdateRevision = (): string => {
    const content = getPlaywfContentConfig();
    const accountIds = Object.keys(content?.accountMods ?? {}).sort();
    const accountRevisions = Object.fromEntries(
        accountIds.map(accountId => [accountId, getPlaywfServerScriptsState(accountId).revision])
    );
    const revisionInput = {
        schemaVersion: content?.schemaVersion ?? 1,
        namespace: content?.namespace ?? defaultNamespace,
        mods: content?.mods ?? [],
        accountMods: Object.fromEntries(
            accountIds.map(accountId => [accountId, content?.accountMods?.[accountId] ?? []])
        ),
        accountBlacklist: [...(content?.accountBlacklist ?? [])].sort(),
        globalRevision: getPlaywfServerScriptsState().revision,
        accountRevisions
    };
    return crypto.createHash("sha256").update(JSON.stringify(revisionInput)).digest("hex");
};

export const writePlaywfServerScriptFiles = async (
    scripts: IPlaywfScriptEditorEntry[],
    accountScripts: Partial<Record<string, IPlaywfScriptEditorEntry[]>> = {}
): Promise<string[]> => {
    const content = getPlaywfContentConfig();
    const previousSourcePaths = [
        ...(content?.mods ?? []),
        ...Object.values(content?.accountMods ?? {}).flatMap(mods => mods ?? [])
    ]
        .map(mod => mod.sourcePath)
        .filter((sourcePath): sourcePath is string => !!sourcePath && !!getManagedScriptFilePath(sourcePath));
    const writes = [
        ...scripts.map(script => ({ accountId: undefined, script })),
        ...Object.entries(accountScripts).flatMap(([accountId, entries]) =>
            (entries ?? []).map(script => ({ accountId, script }))
        )
    ];
    const nextSourcePaths = new Set(
        writes.map(({ script, accountId }) => getPlaywfServerScriptSourcePath(script.name, accountId))
    );

    await fsPromises.mkdir(serverScriptDirectory, { recursive: true });
    for (const { script, accountId } of writes) {
        const sourcePath = getPlaywfServerScriptSourcePath(script.name, accountId);
        const targetPath = getManagedScriptFilePath(sourcePath)!;
        const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
        try {
            await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
            await fsPromises.writeFile(temporaryPath, script.source, "utf8");
            await fsPromises.rename(temporaryPath, targetPath);
        } finally {
            await fsPromises.rm(temporaryPath, { force: true });
        }
    }

    return previousSourcePaths.filter(sourcePath => !nextSourcePaths.has(sourcePath));
};

export const removePlaywfServerScriptFiles = async (sourcePaths: string[]): Promise<void> => {
    const filePaths = sourcePaths.map(getManagedScriptFilePath).filter((filePath): filePath is string => !!filePath);
    await Promise.all(filePaths.map(filePath => fsPromises.rm(filePath, { force: true })));
};

export const getPlaywfAutoStartScripts = (): string[] => {
    if (config.tunables?.prohibitScripts) return [];
    return (getPlaywfContentConfig()?.mods ?? [])
        .filter(mod => mod.enabled !== false && mod.autoStart !== false && getScriptSource(mod) !== undefined)
        .map(mod => mod.scriptPath!);
};

export const playwfContentMiddleware: RequestHandler = (req, res, next) => {
    if (req.method != "GET" && req.method != "HEAD") {
        next();
        return;
    }
    const configured = getConfiguredScript(req.path);
    if (!configured) {
        next();
        return;
    }
    const script = getPlaywfScript(req.path);
    if (!script) {
        res.status(404).send("Pluto script is unavailable");
        return;
    }
    res.type("text/plain").setHeader("Cache-Control", "no-cache").send(script.source);
};
