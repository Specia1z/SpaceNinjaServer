import { toMongoDate2, toOid2 } from "../helpers/inventoryHelpers.ts";
import type { IMessageClient, IMessageDatabase } from "../types/inboxTypes.ts";
import type { TMessageDocument } from "../models/inboxModel.ts";
import { Inbox } from "../models/inboxModel.ts";
import type { QueryFilter, Types } from "mongoose";
import { buildVersionToInt } from "../helpers/versionHelper.ts";

export const getInboxFilter = (
    accountId: string | Types.ObjectId,
    buildLabel: string
): QueryFilter<IMessageDatabase> => {
    return {
        ownerId: accountId,
        $or: [{ minBuildVersion: { $exists: false } }, { minBuildVersion: { $lte: buildVersionToInt(buildLabel) } }]
    };
};

export const getMessagesSorted = async (
    accountId: string | Types.ObjectId,
    buildLabel: string,
    afterId?: string | Types.ObjectId
): Promise<TMessageDocument[]> => {
    const query = getInboxFilter(accountId, buildLabel);
    if (afterId) {
        query._id = { $gt: afterId };
    }
    return await Inbox.find(query).sort({ date: -1 });
};

export const deleteMessageRead = async (
    messageId: string | Types.ObjectId,
    ownerId: string | Types.ObjectId
): Promise<void> => {
    await Inbox.findOneAndDelete({ _id: messageId, ownerId, r: true });
};

/**
 * Atomically claim a message for its owner and remove every one-shot payload.
 * Returning the document before the update lets the caller apply the payload exactly once.
 */
export const claimMessage = async (
    messageId: string | Types.ObjectId,
    ownerId: string | Types.ObjectId
): Promise<TMessageDocument | null> => {
    return await Inbox.findOneAndUpdate(
        { _id: messageId, ownerId, r: { $ne: true } },
        {
            $set: { r: true },
            $unset: {
                att: 1,
                countedAtt: 1,
                gifts: 1,
                RegularCredits: 1,
                PremiumCredits: 1,
                PrimeTokens: 1
            }
        },
        { returnDocument: "before" }
    );
};

export const deleteAllMessagesRead = async (accountId: string | Types.ObjectId): Promise<void> => {
    await Inbox.deleteMany({ ownerId: accountId, r: true });
};

export const deleteAllMessagesReadNonCin = async (accountId: string | Types.ObjectId): Promise<void> => {
    await Inbox.deleteMany({ ownerId: accountId, r: true, cinematic: null });
};

export const createMessage = async (
    accountId: string | Types.ObjectId,
    messages: IMessageCreationTemplate[]
): Promise<void> => {
    const ownerIdMessages = messages.map(m => ({
        ...m,
        date: m.date ?? new Date(),
        ownerId: accountId
    }));
    await Inbox.insertMany(ownerIdMessages);
};

export interface IMessageCreationTemplate extends Omit<IMessageDatabase, "_id" | "date" | "ownerId"> {
    date?: Date;
}

export const exportInboxMessage = (messageDatabase: TMessageDocument, buildLabel: string): IMessageClient => {
    const messageClient = messageDatabase.toJSON<IMessageClient>();

    if (messageDatabase.globaUpgradeId) {
        messageClient.globaUpgradeId = toOid2(messageDatabase.globaUpgradeId, buildLabel);
    }

    messageClient.date = toMongoDate2(messageDatabase.date, buildLabel);

    if (messageDatabase.startDate && messageDatabase.endDate) {
        messageClient.startDate = toMongoDate2(messageDatabase.startDate, buildLabel);
        messageClient.endDate = toMongoDate2(messageDatabase.endDate, buildLabel);
    } else {
        delete messageClient.startDate;
        delete messageClient.endDate;
    }

    return messageClient;
};
