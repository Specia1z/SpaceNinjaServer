import type { IFriendInfo } from "../types/friendTypes.ts";
import { getInventory } from "./inventoryService.ts";
import { Account } from "../models/loginModel.ts";
import type { Types } from "mongoose";
import { Friendship } from "../models/friendModel.ts";
import { fromOid, toMongoDate2, version_compare } from "../helpers/inventoryHelpers.ts";
import { getUnicodeName } from "./loginService.ts";
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";

export const shouldIncludeLastPlatform = (buildLabel: string): boolean =>
    version_compare(buildLabel, gameToBuildVersion["44.0.0"]) < 0;

export const addAccountDataToFriendInfo = async (
    info: IFriendInfo,
    buildLabel: string,
    useUnicodeName?: boolean
): Promise<void> => {
    const includeLastPlatform = shouldIncludeLastPlatform(buildLabel);
    const account = (await Account.findById(
        fromOid(info._id),
        useUnicodeName ? undefined : `DisplayName LastLogin${includeLastPlatform ? " LastPlatform" : ""}`
    ))!;
    info.DisplayName = useUnicodeName ? getUnicodeName(account, buildLabel) : account.DisplayName;
    info.LastLogin = toMongoDate2(account.LastLogin, buildLabel);
    if (includeLastPlatform) {
        info.LastPlatform = account.LastPlatform;
    }
};

export const addInventoryDataToFriendInfo = async (info: IFriendInfo): Promise<void> => {
    const inventory = await getInventory(fromOid(info._id), "PlayerLevel ActiveAvatarImageType spoofMasteryRank");
    info.PlayerLevel = inventory.spoofMasteryRank == -1 ? inventory.PlayerLevel : inventory.spoofMasteryRank;
    info.ActiveAvatarImageType = inventory.ActiveAvatarImageType;
    info.TitleType = inventory.TitleType;
};

export const areFriends = async (a: Types.ObjectId | string, b: Types.ObjectId | string): Promise<boolean> => {
    const [aAddedB, bAddedA] = await Promise.all([
        Friendship.exists({ owner: a, friend: b }),
        Friendship.exists({ owner: b, friend: a })
    ]);
    return Boolean(aAddedB && bAddedA);
};

export const areFriendsOfFriends = async (a: Types.ObjectId | string, b: Types.ObjectId | string): Promise<boolean> => {
    const [aInternalFriends, bInternalFriends] = await Promise.all([
        Friendship.find({ owner: a }),
        Friendship.find({ owner: b })
    ]);
    for (const aInternalFriend of aInternalFriends) {
        if (bInternalFriends.find(x => x.friend.equals(aInternalFriend.friend))) {
            const c = aInternalFriend.friend;
            const [cAcceptedA, cAcceptedB] = await Promise.all([
                Friendship.exists({ owner: c, friend: a }),
                Friendship.exists({ owner: c, friend: b })
            ]);
            if (cAcceptedA && cAcceptedB) {
                return true;
            }
        }
    }
    return false;
};
