import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { config, type IMetadataPatchConfig } from "../../services/configService.ts";
import { saveConfig } from "../../services/configWriterService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { compileMetadataPatches, getTunablesForClient } from "../../services/tunablesService.ts";
import { forEachWsClient, sendWsBroadcastEx } from "../../services/wsService.ts";

const MAX_PATCHES = 500;
const MAX_NAME_LENGTH = 200;
const MAX_TARGET_LENGTH = 1000;
const MAX_OPERATION_LENGTH = 10000;

const getResponse = (): { patches: IMetadataPatchConfig[]; compiled: string; revision: string } => {
    const patches = config.tunables?.metadataPatches ?? [];
    const compiled = compileMetadataPatches(patches);
    return {
        patches,
        compiled,
        revision: compiled ? crypto.createHash("sha256").update(compiled).digest("hex") : ""
    };
};

export const parseMetadataPatches = (value: unknown): IMetadataPatchConfig[] => {
    if (!Array.isArray(value) || value.length > MAX_PATCHES) {
        throw new Error(`metadataPatches must be an array with at most ${MAX_PATCHES} entries`);
    }

    return value.map((raw, patchIndex) => {
        if (!raw || typeof raw != "object" || Array.isArray(raw)) {
            throw new Error(`Patch ${patchIndex + 1} must be an object`);
        }
        const input = raw as Record<string, unknown>;
        if (input.enabled !== undefined && typeof input.enabled != "boolean") {
            throw new Error(`Patch ${patchIndex + 1} enabled must be a boolean`);
        }
        const name = input.name === undefined ? undefined : String(input.name).trim();
        if (name && name.length > MAX_NAME_LENGTH) {
            throw new Error(`Patch ${patchIndex + 1} name is too long`);
        }
        if (!Array.isArray(input.targets) || input.targets.length == 0) {
            throw new Error(`Patch ${patchIndex + 1} needs at least one target`);
        }
        const targets = input.targets.map((rawTarget, targetIndex) => {
            if (typeof rawTarget != "string") {
                throw new Error(`Patch ${patchIndex + 1}, target ${targetIndex + 1} must be a string`);
            }
            const target = rawTarget.trim();
            if (!target.startsWith("/") || target.includes("\r") || target.includes("\n")) {
                throw new Error(`Patch ${patchIndex + 1}, target ${targetIndex + 1} is not an absolute metadata path`);
            }
            if (target.length > MAX_TARGET_LENGTH) {
                throw new Error(`Patch ${patchIndex + 1}, target ${targetIndex + 1} is too long`);
            }
            return target;
        });
        if (input.operations !== undefined && !Array.isArray(input.operations)) {
            throw new Error(`Patch ${patchIndex + 1} operations must be an array`);
        }
        const operations = (input.operations ?? []).map((rawOperation, operationIndex) => {
            if (typeof rawOperation != "string") {
                throw new Error(`Patch ${patchIndex + 1}, operation ${operationIndex + 1} must be a string`);
            }
            const operation = rawOperation.replaceAll("\r", "").trim();
            if (operation.length > MAX_OPERATION_LENGTH) {
                throw new Error(`Patch ${patchIndex + 1}, operation ${operationIndex + 1} is too long`);
            }
            return operation;
        });

        return {
            name: name || undefined,
            enabled: input.enabled === undefined ? true : input.enabled === true,
            targets,
            operations
        };
    });
};

export const getMetadataPatchesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }
    res.json(getResponse());
};

export const saveMetadataPatchesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }

    try {
        const body = req.body as Record<string, unknown>;
        const patches = parseMetadataPatches(body.patches);
        config.tunables ??= {};
        config.tunables.metadataPatches = patches;
        await saveConfig();

        forEachWsClient(client => {
            if (client.isGame) {
                client.send(
                    JSON.stringify({
                        tunables: getTunablesForClient(client.address, client.reflexiveAddress)
                    })
                );
            }
        });
        sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
        res.json(getResponse());
    } catch (error) {
        res.status(400).send((error as Error).message);
    }
};
