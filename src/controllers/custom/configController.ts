import type { RequestHandler } from "express";
import {
    configIdToIndexable,
    inventoryAffectingConfigKeys,
    validateRegistrationRateLimitConfig,
    validateWorldStateBoostConfig,
    validateVarziaRotationConfig,
    validateClientConfig
} from "../../services/configService.ts";
import { syncConfigWithDatabase } from "../../services/configWatcherService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { saveConfig } from "../../services/configWriterService.ts";
import { sendWsBroadcastEx, sendWsBroadcast } from "../../services/wsService.ts";
import { validatePlayerPolicyField } from "../../services/playerPortalService.ts";
import { applyGlobalAccountCheatSideEffects, validateAccountCheatConfig } from "../../services/accountCheatService.ts";
import type { IAccountCheats } from "../../types/inventoryTypes/inventoryTypes.ts";
import { unlockStarChartForExistingAccounts } from "../../services/accountInitializationService.ts";

export const getConfigController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (isAdministrator(account)) {
        const responseData: Record<string, boolean | string | number | null> = {};
        for (const id of req.body as string[]) {
            const [obj, idx] = configIdToIndexable(id);
            responseData[id] = obj[idx] ?? null;
        }
        res.json(responseData);
    } else {
        res.json(null);
    }
};

export const setConfigController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (isAdministrator(account)) {
        const edits = req.body as Record<string, boolean | string | number | null>;
        for (const [id, value] of Object.entries(edits)) {
            if (id === "unlockAllMissionsForNewAccounts" && typeof value !== "boolean") {
                res.status(400).send(`${id} must be a boolean`);
                return;
            }
            const error = validateRegistrationRateLimitConfig(id, value);
            if (error) {
                res.status(400).send(error);
                return;
            }
            const worldStateBoostError = validateWorldStateBoostConfig(id, value);
            if (worldStateBoostError) {
                res.status(400).send(worldStateBoostError);
                return;
            }
            const varziaRotationError = validateVarziaRotationConfig(id, value);
            if (varziaRotationError) {
                res.status(400).send(varziaRotationError);
                return;
            }
            const clientConfigError = validateClientConfig(id, value);
            if (clientConfigError) {
                res.status(400).send(clientConfigError);
                return;
            }
            const playerPortalError = validatePlayerPolicyField(id, value);
            if (playerPortalError) {
                res.status(400).send(playerPortalError);
                return;
            }
            const accountCheatError = validateAccountCheatConfig(id, value);
            if (accountCheatError) {
                res.status(400).send(accountCheatError);
                return;
            }
        }
        let isWorldStateUpdate = false;
        let isInventoryUpdate = false;
        const accountCheatEdits: { key: string; value: unknown }[] = [];
        for (const [id, value] of Object.entries(edits)) {
            if (id.startsWith("worldState")) isWorldStateUpdate = true;
            if ((inventoryAffectingConfigKeys as readonly string[]).includes(id)) {
                isInventoryUpdate = true;
            }
            if (id.startsWith("accountCheats.")) {
                isInventoryUpdate = true;
                accountCheatEdits.push({ key: id.substring("accountCheats.".length), value });
            }
            const [obj, idx] = configIdToIndexable(id);
            if (id == "worldState.boostExpiresAt" && (value === null || value === "")) {
                delete obj[idx];
            } else {
                obj[idx] = value;
            }
        }
        for (const edit of accountCheatEdits) {
            await applyGlobalAccountCheatSideEffects(edit.key as keyof IAccountCheats, edit.value);
        }
        await saveConfig();
        if (isWorldStateUpdate) sendWsBroadcast({ sync_world_state: true });
        if (isInventoryUpdate) sendWsBroadcast({ sync_inventory: true });
        syncConfigWithDatabase();
        try {
            if (edits.unlockAllMissionsForNewAccounts === true) {
                await unlockStarChartForExistingAccounts();
            }
        } finally {
            sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
        }
        res.end();
    } else {
        res.status(401).end();
    }
};
