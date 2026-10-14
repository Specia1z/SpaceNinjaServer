import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { getInvasionRuntimeStatus, refreshLiveWorldState } from "../../services/liveWorldStateService.ts";
import { config } from "../../services/configService.ts";
import { getExportRegions } from "../../services/publicExportService.ts";

const unauthorized = (res: Parameters<RequestHandler>[1]): void => {
    res.status(401).end();
};

const getLanguage = (
    req: Parameters<RequestHandler>[0],
    account: Awaited<ReturnType<typeof getAccountForRequest>>
): string => (typeof req.query.lang == "string" ? req.query.lang : (account.Language ?? "en"));

const localizeInvasionRuntime = (
    runtime: ReturnType<typeof getInvasionRuntimeStatus>,
    language: string
): ReturnType<typeof getInvasionRuntimeStatus> & {
    invasions: Array<
        ReturnType<typeof getInvasionRuntimeStatus>["invasions"][number] & {
            nodeName: string;
            systemName: string;
        }
    >;
} => {
    const regions = new Map<string, { name: string; systemName: string }>();
    for (const region of getExportRegions(language).ExportRegions) {
        regions.set(region.uniqueName, { name: region.name, systemName: region.systemName });
    }
    return {
        ...runtime,
        invasions: runtime.invasions.map(invasion => {
            const region = regions.get(invasion.node);
            return {
                ...invasion,
                nodeName: region?.name ?? invasion.node,
                systemName: region?.systemName ?? ""
            };
        })
    };
};

export const getWorldActivitiesController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        unauthorized(res);
        return;
    }

    await refreshLiveWorldState();
    const language = getLanguage(req, account);
    res.json({
        invasion: localizeInvasionRuntime(getInvasionRuntimeStatus(), language),
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
    res.json(localizeInvasionRuntime(getInvasionRuntimeStatus(), getLanguage(req, account)));
};
