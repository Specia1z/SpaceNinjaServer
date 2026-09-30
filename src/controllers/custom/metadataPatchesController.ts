import crypto from "node:crypto";
import type { RequestHandler } from "express";
import type { IMetadataPatchConfig } from "../../services/configService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import {
    compileMetadataPatchesForAccount,
    getMetadataPatchesForAccount,
    getTunablesForClient,
    type IMetadataPatchSource
} from "../../services/tunablesService.ts";
import { getMetadataPatchState, saveMetadataPatchState } from "../../services/metadataPatchService.ts";
import { forEachWsClient, sendWsBroadcastEx } from "../../services/wsService.ts";
import { Account } from "../../models/loginModel.ts";

const MAX_PATCHES = 500;
const MAX_NAME_LENGTH = 200;
const MAX_TARGET_LENGTH = 1000;
const MAX_OPERATION_LENGTH = 10000;
const MAX_PATCH_TEXT_LENGTH = 12 * 1024 * 1024;
const MAX_ACCOUNT_PATCH_ENTRIES = 5000;
const MAX_RAW_PATCH_LENGTH = 12 * 1024 * 1024;
const MAX_METADATA_SETTINGS_BYTES = 14 * 1024 * 1024;

const sourceLabel = (entry: IMetadataPatchSource): string =>
    entry.source == "global" ? "Global" : `Account ${entry.sourceId ?? ""}`;

interface IMetadataPatchesResponse {
    rawPatches: string;
    patches: IMetadataPatchConfig[];
    accountMetadataPatches: Partial<Record<string, IMetadataPatchConfig[]>>;
    selectedAccountId: string;
    compiled: string;
    sources: {
        order: number;
        source: IMetadataPatchSource["source"];
        sourceLabel: string;
        name: string;
        enabled: boolean;
        targets: string[];
    }[];
    revision: string;
}

const getResponse = (accountId?: string): IMetadataPatchesResponse => {
    const metadata = getMetadataPatchState();
    const patches = metadata.patches;
    const accountMetadataPatches = metadata.accountPatches;
    const entries = getMetadataPatchesForAccount(accountId);
    const compiled = compileMetadataPatchesForAccount(accountId);
    return {
        rawPatches: metadata.rawPatches,
        patches,
        accountMetadataPatches,
        selectedAccountId: accountId ?? "",
        compiled,
        sources: entries.map(entry => ({
            order: entry.order + 1,
            source: entry.source,
            sourceLabel: sourceLabel(entry),
            name: entry.patch.name ?? "",
            enabled: entry.patch.enabled !== false,
            targets: entry.patch.targets ?? []
        })),
        revision: compiled ? crypto.createHash("sha256").update(compiled).digest("hex") : ""
    };
};

const parseRawMetadataPatches = (value: unknown): string => {
    if (typeof value != "string") {
        throw new Error("rawPatches must be a string");
    }
    if (value.length > MAX_RAW_PATCH_LENGTH) {
        throw new Error(`rawPatches must be at most ${MAX_RAW_PATCH_LENGTH} characters`);
    }
    return value;
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
        if (input.text !== undefined) {
            if (typeof input.text != "string") {
                throw new Error(`Patch ${patchIndex + 1} text must be a string`);
            }
            const text = input.text.replaceAll("\r", "");
            if (!text.trim()) {
                throw new Error(`Patch ${patchIndex + 1} text must not be empty`);
            }
            if (text.length > MAX_PATCH_TEXT_LENGTH) {
                throw new Error(`Patch ${patchIndex + 1} text is too long`);
            }
            return {
                name: name || undefined,
                enabled: input.enabled === undefined ? true : input.enabled === true,
                text
            };
        }
        if (!Array.isArray(input.targets) || input.targets.length == 0) {
            throw new Error(`Patch ${patchIndex + 1} needs text or at least one target`);
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

export const parseAccountMetadataPatches = (value: unknown): Record<string, IMetadataPatchConfig[]> => {
    if (value === undefined) return {};
    if (!value || typeof value != "object" || Array.isArray(value)) {
        throw new Error("accountMetadataPatches must be an object");
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_ACCOUNT_PATCH_ENTRIES) {
        throw new Error(`accountMetadataPatches must contain at most ${MAX_ACCOUNT_PATCH_ENTRIES} accounts`);
    }
    return Object.fromEntries(
        entries.map(([accountId, patches]) => {
            if (!accountId.trim() || accountId.length > 100) {
                throw new Error("Each accountMetadataPatches key must be a non-empty account ID");
            }
            return [accountId, parseMetadataPatches(patches)];
        })
    );
};

export const getMetadataPatchesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }
    const selectedAccountId = typeof req.query.selectedAccountId == "string" ? req.query.selectedAccountId : undefined;
    res.json({
        ...getResponse(selectedAccountId),
        accounts: (await Account.find({}, "DisplayName").sort({ DisplayName: 1 })).map(account => ({
            id: account._id.toString(),
            displayName: account.DisplayName,
            hasCustomPatches: Boolean(getMetadataPatchState().accountPatches[account._id.toString()]?.length)
        }))
    });
};

export const saveMetadataPatchesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }

    try {
        const body = req.body as Record<string, unknown>;
        const rawPatches =
            body.rawPatches === undefined
                ? getMetadataPatchState().rawPatches
                : parseRawMetadataPatches(body.rawPatches);
        const patches = parseMetadataPatches(body.patches);
        const accountMetadataPatches =
            body.accountMetadataPatches === undefined
                ? getMetadataPatchState().accountPatches
                : parseAccountMetadataPatches(body.accountMetadataPatches);
        const settingsSize = Buffer.byteLength(JSON.stringify({ rawPatches, patches, accountMetadataPatches }), "utf8");
        if (settingsSize > MAX_METADATA_SETTINGS_BYTES) {
            throw new Error(`Metadata patch settings must be at most ${MAX_METADATA_SETTINGS_BYTES} bytes`);
        }
        await saveMetadataPatchState({ rawPatches, patches, accountPatches: accountMetadataPatches });

        forEachWsClient(client => {
            if (client.isGame) {
                client.send(
                    JSON.stringify({
                        tunables: getTunablesForClient(client.address, client.reflexiveAddress, client.accountId)
                    })
                );
            }
        });
        sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
        const selectedAccountId =
            typeof req.query.selectedAccountId == "string" ? req.query.selectedAccountId : undefined;
        res.json({
            ...getResponse(selectedAccountId),
            accounts: (await Account.find({}, "DisplayName").sort({ DisplayName: 1 })).map(account => ({
                id: account._id.toString(),
                displayName: account.DisplayName,
                hasCustomPatches: Boolean(getMetadataPatchState().accountPatches[account._id.toString()]?.length)
            }))
        });
    } catch (error) {
        res.status(400).send((error as Error).message);
    }
};
