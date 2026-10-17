import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { RequestHandler } from "express";
import { repoDir } from "../helpers/pathHelper.ts";
import { config, type IPlaywfContentConfig, type IPlaywfContentMod } from "./configService.ts";

const defaultNamespace = "/PlayWF";
const scriptPathPattern = /^\/(?:[^/]+\/)*[^/]+\.pluto$/;

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

export const getPlaywfContentConfig = (): IPlaywfContentConfig | undefined => {
    const value: unknown = config.tunables?.playwfContent;
    if (!isRecord(value)) return undefined;
    const rawMods = value.mods;
    const namespace = normalizeNamespace(value.namespace);
    const namespacePrefix = namespace.endsWith("/") ? namespace : `${namespace}/`;
    const mods = Array.isArray(rawMods)
        ? rawMods
              .map(normalizeMod)
              .filter((mod): mod is IPlaywfContentMod => !!mod)
              .filter(mod => mod.scriptPath!.startsWith(namespacePrefix))
        : [];
    return {
        schemaVersion: typeof value.schemaVersion == "number" ? value.schemaVersion : 1,
        namespace,
        revision: typeof value.revision == "string" ? value.revision : "",
        mods
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

export const getPlaywfScriptEditorEntries = (): IPlaywfScriptEditorEntry[] => {
    return (getPlaywfContentConfig()?.mods ?? [])
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

export const getPlaywfServerScriptsState = (): IPlaywfServerScriptsState => {
    const scripts = (getPlaywfContentConfig()?.mods ?? [])
        .filter(mod => mod.enabled !== false)
        .map(mod => {
            const source = getScriptSource(mod);
            return source === undefined ? undefined : { path: mod.scriptPath!, source };
        })
        .filter((script): script is IResolvedPlaywfScript => !!script);
    const payload = JSON.stringify(scripts);
    return {
        scripts,
        payload,
        revision: crypto.createHash("sha256").update(payload).digest("hex")
    };
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
