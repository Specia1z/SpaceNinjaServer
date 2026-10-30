import type { RequestHandler } from "express";
import { config, normaliseBlockedClientAddresses, normaliseClientAddress } from "../../services/configService.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";
import { saveConfig } from "../../services/configWriterService.ts";
import { sendWsBroadcastEx } from "../../services/wsService.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<void> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
};

const getAddresses = (): string[] => normaliseBlockedClientAddresses(config.blockedClientAddresses);

const getAddressFromBody = (body: unknown): string | undefined => {
    if (typeof body != "object" || body == null || Array.isArray(body)) return undefined;
    const address = (body as Record<string, unknown>).address;
    return typeof address == "string" ? normaliseClientAddress(address) : undefined;
};

const saveAddresses = async (addresses: string[], req: Parameters<RequestHandler>[0]): Promise<void> => {
    config.blockedClientAddresses = addresses;
    await saveConfig();
    sendWsBroadcastEx({ config_reloaded: true }, undefined, parseInt(String(req.query.wsid)));
};

export const getIpBlacklistController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json({ blockedClientAddresses: getAddresses() });
};

export const addIpBlacklistController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const address = getAddressFromBody(req.body);
    if (!address) {
        res.status(400).send("address must be a valid IPv4 or IPv6 address");
        return;
    }
    const addresses = getAddresses();
    if (!addresses.includes(address)) {
        addresses.push(address);
        await saveAddresses(addresses, req);
    }
    res.json({ blockedClientAddresses: addresses });
};

export const removeIpBlacklistController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const address = getAddressFromBody(req.body);
    if (!address) {
        res.status(400).send("address must be a valid IPv4 or IPv6 address");
        return;
    }
    const currentAddresses = getAddresses();
    const addresses = currentAddresses.filter(blockedAddress => blockedAddress != address);
    if (addresses.length != currentAddresses.length) await saveAddresses(addresses, req);
    res.json({ blockedClientAddresses: addresses });
};
