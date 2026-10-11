import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { getInvasionRuntimeStatus, refreshLiveWorldState } from "../../services/liveWorldStateService.ts";
import { config } from "../../services/configService.ts";

const unauthorized = (res: Parameters<RequestHandler>[1]): void => {
    res.status(401).end();
};

export const getWorldActivitiesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        unauthorized(res);
        return;
    }

    await refreshLiveWorldState();
    res.json({
        invasion: getInvasionRuntimeStatus(),
        config: {
            liveSync: config.worldState?.liveSync ?? false,
            invasionMode: config.worldState?.invasionMode ?? "official",
            invasionRotationHours: config.worldState?.invasionRotationHours ?? 24,
            invasionMaxDurationHours: config.worldState?.invasionMaxDurationHours ?? 48
        }
    });
};

export const refreshWorldActivitiesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        unauthorized(res);
        return;
    }

    await refreshLiveWorldState();
    res.json(getInvasionRuntimeStatus());
};
