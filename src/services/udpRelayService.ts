import dgram, { type RemoteInfo, type Socket } from "node:dgram";
import { config } from "./configService.ts";
import { logger } from "../utils/logger.ts";

interface IEndpoint {
    host: string;
    port: number;
}

interface IRelayClient {
    client: RemoteInfo;
    upstream: Socket;
    lastActivity: number;
    timer: NodeJS.Timeout;
}

let relays: Socket[] = [];
const clients = new Map<string, IRelayClient>();

const parseEndpoint = (value: string): IEndpoint => {
    const match = value.match(/^\[([^\]]+)\]:(\d+)$/) ?? value.match(/^(.+):(\d+)$/);
    if (!match) {
        throw new Error(`Invalid UDP endpoint: ${value}`);
    }
    const port = Number.parseInt(match[2], 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid UDP endpoint port: ${value}`);
    }
    return { host: match[1], port };
};

const getClientKey = (listenerOffset: number, client: RemoteInfo): string =>
    `${listenerOffset}/${client.address}/${client.port}/${client.family}`;

const closeClient = (key: string): void => {
    const client = clients.get(key);
    if (!client) {
        return;
    }
    clearTimeout(client.timer);
    client.upstream.close();
    clients.delete(key);
};

const scheduleExpiry = (key: string): NodeJS.Timeout =>
    setTimeout(() => {
        const client = clients.get(key);
        if (!client) {
            return;
        }
        if (Date.now() - client.lastActivity >= (config.udpRelayIdleTimeoutMs ?? 300_000)) {
            closeClient(key);
        } else {
            client.timer = scheduleExpiry(key);
        }
    }, config.udpRelayIdleTimeoutMs ?? 300_000);

const createClient = (relay: Socket, key: string, client: RemoteInfo, target: IEndpoint): IRelayClient => {
    const upstream = dgram.createSocket(client.family == "IPv6" ? "udp6" : "udp4");
    const state: IRelayClient = {
        client,
        upstream,
        lastActivity: Date.now(),
        timer: scheduleExpiry(key)
    };

    upstream.on("message", (message, remote) => {
        const current = clients.get(key);
        if (!current || remote.port != target.port) {
            return;
        }
        current.lastActivity = Date.now();
        relay.send(message, current.client.port, current.client.address);
    });
    upstream.on("error", error => {
        logger.debug(`UDP relay upstream ${key} stopped: ${error.message}`);
        closeClient(key);
    });
    upstream.bind(() => undefined);
    return state;
};

export const isUdpRelayEnabled = (): boolean => Boolean(config.udpRelayPort && config.udpRelayTarget);

export const getUdpRelayParams = (): string =>
    `${config.udpRelayBindAddress ?? "0.0.0.0"}:${config.udpRelayPort ?? ""}+${config.udpRelayPortPoolSize ?? 1}/${config.udpRelayTarget ?? ""}`;

export const startUdpRelay = async (): Promise<void> => {
    if (!isUdpRelayEnabled() || relays.length > 0) {
        return Promise.resolve();
    }

    const basePort = config.udpRelayPort!;
    const poolSize = config.udpRelayPortPoolSize ?? 1;
    if (!Number.isInteger(poolSize) || poolSize < 1 || basePort + poolSize - 1 > 65535) {
        throw new Error(`Invalid UDP relay port pool: ${basePort} + ${poolSize}`);
    }
    const bindAddress = config.udpRelayBindAddress ?? "0.0.0.0";
    const baseTarget = parseEndpoint(config.udpRelayTarget!);
    if (baseTarget.port + poolSize - 1 > 65535) {
        throw new Error(`Invalid UDP relay target pool: ${baseTarget.port} + ${poolSize}`);
    }

    try {
        await Promise.all(
            Array.from({ length: poolSize }, (_, listenerOffset) => {
                const port = basePort + listenerOffset;
                const target = { host: baseTarget.host, port: baseTarget.port + listenerOffset };
                const relay = dgram.createSocket(target.host.includes(":") ? "udp6" : "udp4");
                relays.push(relay);

                relay.on("message", (message, client) => {
                    const key = getClientKey(listenerOffset, client);
                    let state = clients.get(key);
                    if (!state) {
                        state = createClient(relay, key, client, target);
                        clients.set(key, state);
                    }
                    state.lastActivity = Date.now();
                    state.upstream.send(message, target.port, target.host);
                });
                relay.on("error", error => {
                    logger.error(`UDP relay error on ${bindAddress}:${port}: ${error.message}`);
                });

                return new Promise<void>((resolve, reject) => {
                    const onError = (error: Error): void => {
                        relay.close();
                        reject(error);
                    };
                    relay.once("error", onError);
                    relay.bind(port, bindAddress, () => {
                        relay.off("error", onError);
                        logger.info(`UDP relay started on ${bindAddress}:${port} -> ${target.host}:${target.port}`);
                        resolve();
                    });
                });
            })
        );
    } catch (error) {
        await stopUdpRelay();
        throw error;
    }
};

export const stopUdpRelay = (): Promise<void> => {
    for (const key of clients.keys()) {
        closeClient(key);
    }
    if (relays.length == 0) {
        return Promise.resolve();
    }
    const sockets = relays;
    relays = [];
    return Promise.all(sockets.map(socket => new Promise<void>(resolve => socket.close(() => resolve())))).then(
        () => undefined
    );
};
