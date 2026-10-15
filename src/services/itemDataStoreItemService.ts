import { ExportBoosters } from "warframe-public-export-plus";

export const isStoreItem = (type: string): boolean => {
    return (
        type.startsWith("/Lotus/StoreItems/") || type.startsWith("/Lotus/Types/StoreItems/") || type in ExportBoosters
    );
};

export const toStoreItem = (type: string): string => {
    if (type.startsWith("/Lotus/Types/Boosters/")) {
        const boosterEntry = Object.entries(ExportBoosters).find(arr => arr[1].typeName == type);
        if (boosterEntry) {
            return boosterEntry[0];
        }
        throw new Error(`could not convert ${type} to a store item`);
    }
    if (type.startsWith("/Lotus/StoreItems/")) return type;
    if (type.startsWith("/Lotus/Types/StoreItems/")) {
        return "/Lotus/StoreItems/" + type.substring("/Lotus/Types/StoreItems/".length);
    }
    return "/Lotus/StoreItems/" + type.substring("/Lotus/".length);
};

export const fromStoreItem = (type: string): string => {
    let storeItemPath: string | undefined;
    if (type.startsWith("/Lotus/StoreItems/")) {
        storeItemPath = type.substring("/Lotus/StoreItems/".length);
    } else if (type.startsWith("/Lotus/Types/StoreItems/")) {
        storeItemPath = type.substring("/Lotus/Types/StoreItems/".length);
    }

    if (type in ExportBoosters) {
        return ExportBoosters[type].typeName;
    }

    if (storeItemPath !== undefined) {
        if (storeItemPath.startsWith("AvatarImages/") || storeItemPath.startsWith("SuitCustomizations/")) {
            return "/Lotus/Types/StoreItems/" + storeItemPath;
        }
        return "/Lotus/" + storeItemPath;
    }

    throw new Error(`${type} is not a store item`);
};
