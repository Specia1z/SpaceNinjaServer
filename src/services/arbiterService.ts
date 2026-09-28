import { packHubDatagram } from "../helpers/udp.ts";
import { config, type IHubServer, type TRegionId } from "./configService.ts";
import dgram from "node:dgram";

export interface IHubInstance {
    Players: number;
    Hub: string;
}

export const hubInstances: Record<string, IHubInstance> = {};

const endpointAssignments = new Map<string, Map<string, number>>();
const endpointOwners = new Map<string, Map<number, string>>();

const hashAccountId = (accountId: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < accountId.length; ++index) {
        hash ^= accountId.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

export const assignEndpointPort = (address: string, accountId: string | undefined, poolSize = 1): string => {
    if (!accountId || poolSize <= 1) {
        return address;
    }
    if (!Number.isInteger(poolSize) || poolSize < 1) {
        throw new Error(`Invalid Hub port pool size: ${poolSize}`);
    }

    const match = address.match(/^(.+):(\d+)$/);
    if (!match) {
        throw new Error(`Invalid Hub endpoint: ${address}`);
    }
    const basePort = Number.parseInt(match[2], 10);
    if (basePort + poolSize - 1 > 65535) {
        throw new Error(`Hub port pool exceeds 65535: ${address} + ${poolSize}`);
    }

    let assignments = endpointAssignments.get(address);
    let owners = endpointOwners.get(address);
    if (!assignments || !owners) {
        assignments = new Map();
        owners = new Map();
        endpointAssignments.set(address, assignments);
        endpointOwners.set(address, owners);
    }

    let offset = assignments.get(accountId);
    if (offset === undefined) {
        const initialOffset = hashAccountId(accountId) % poolSize;
        for (let attempt = 0; attempt < poolSize; ++attempt) {
            const candidate = (initialOffset + attempt) % poolSize;
            if (!owners.has(candidate)) {
                offset = candidate;
                assignments.set(accountId, candidate);
                owners.set(candidate, accountId);
                break;
            }
        }
    }
    if (offset === undefined) {
        throw new Error(`Hub port pool exhausted for ${address}`);
    }

    return `${match[1]}:${basePort + offset}`;
};

export interface IHubServerStats {
    Players: number;
    Instances: number;
}

export const getAllHubServerStats = (): Record<string, IHubServerStats> => {
    const stats: Record<string, IHubServerStats> = {};
    for (const level of Object.values(hubInstances)) {
        stats[level.Hub] ??= { Players: 0, Instances: 0 };
        stats[level.Hub].Players += level.Players;
        stats[level.Hub].Instances += 1;
    }
    return stats;
};

export const pickHubServer = (regionId: TRegionId): IHubServer => {
    let bestServer = { address: "%THIS_MACHINE%:6952" };
    let bestServerScore = Number.MAX_SAFE_INTEGER;
    const allStats = getAllHubServerStats();
    for (const server of config.hubServers!) {
        const stats = allStats[server.address] as IHubServerStats | undefined;
        const score = (stats?.Players ?? 0) + (stats?.Instances ?? 0) + (server.regions?.includes(regionId) ? 0 : 1000);
        if (score < bestServerScore) {
            bestServer = server;
            bestServerScore = score;
        }
    }
    return bestServer;
};

export const broadcastControlMessages = (level: string, msgs: string[]): void => {
    const instance = hubInstances[level] as IHubInstance | undefined;
    if (instance) {
        instance.Players += 1; // to account for the hubDropped that we will cause here

        const [host, port] = instance.Hub.replaceAll("%THIS_MACHINE%", "127.0.0.1").split(":");
        const socket = dgram.createSocket("udp4");

        socket.send(
            packHubDatagram(
                Buffer.concat([
                    Buffer.from([0xb4, 0x03, 0x18, 0x00, 0x00, 0x00]),
                    Buffer.from("000000000000000000000000", "utf8"),
                    Buffer.alloc(8),
                    Buffer.from([0x03, 0x00, 0x00, 0x00]),
                    Buffer.from("SNS", "utf8"),
                    Buffer.alloc(4),
                    Buffer.from([level.length, 0x00, 0x00, 0x00]),
                    Buffer.from(level, "utf8")
                ])
            ),
            parseInt(port),
            host
        );
        socket.once("message", msg => {
            const peerId = msg.readUInt16LE(13);
            for (const msg of msgs) {
                const header = Buffer.alloc(8);
                header.writeUInt8(0xb4, 0);
                header.writeUInt8(0x07, 1);
                header.writeUInt16LE(peerId, 2);
                header.writeUInt32LE(msg.length, 4);
                socket.send(packHubDatagram(Buffer.concat([header, Buffer.from(msg, "utf8")])), parseInt(port), host);
            }
        });
    }
};
