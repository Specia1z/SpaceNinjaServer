import { model, Schema } from "mongoose";
import type { Types } from "mongoose";

export type TPlayerMarketSide = "buy" | "sell";
export type TPlayerMarketEntryMode = "stack" | "instance";

export interface IPlayerMarketState {
    inventoryField: string;
    itemType: string;
    mode: TPlayerMarketEntryMode;
    midPrice: number;
    systemStock: number;
    updatedAt: Date;
}

export interface IPlayerMarketLedger {
    accountId: Types.ObjectId;
    systemAccountId?: Types.ObjectId;
    requestId: string;
    side: TPlayerMarketSide;
    inventoryField: string;
    itemType: string;
    mode: TPlayerMarketEntryMode;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    status: "pending" | "completed";
    createdAt: Date;
}

export interface IPlayerMarketCounter {
    scope: string;
    periodKey: string;
    tradedPlatinum: number;
    transactions: number;
    quantity: number;
    updatedAt: Date;
}

const stateSchema = new Schema<IPlayerMarketState>({
    inventoryField: { type: String, required: true },
    itemType: { type: String, required: true },
    mode: { type: String, required: true, enum: ["stack", "instance"] },
    midPrice: { type: Number, required: true },
    systemStock: { type: Number, required: true, default: 0 },
    updatedAt: { type: Date, required: true, default: (): Date => new Date() }
});
stateSchema.index({ inventoryField: 1, itemType: 1, mode: 1 }, { unique: true });

const ledgerSchema = new Schema<IPlayerMarketLedger>({
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    systemAccountId: { type: Schema.Types.ObjectId },
    requestId: { type: String, required: true },
    side: { type: String, required: true, enum: ["buy", "sell"] },
    inventoryField: { type: String, required: true },
    itemType: { type: String, required: true },
    mode: { type: String, required: true, enum: ["stack", "instance"] },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, required: true, enum: ["pending", "completed"], default: "pending" },
    createdAt: { type: Date, required: true, default: (): Date => new Date() }
});
ledgerSchema.index({ accountId: 1, requestId: 1 }, { unique: true });

const counterSchema = new Schema<IPlayerMarketCounter>({
    scope: { type: String, required: true },
    periodKey: { type: String, required: true },
    tradedPlatinum: { type: Number, required: true, default: 0 },
    transactions: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 0 },
    updatedAt: { type: Date, required: true, default: (): Date => new Date() }
});

export const PlayerMarketState = model<IPlayerMarketState>("PlayerMarketState", stateSchema);
export const PlayerMarketLedger = model<IPlayerMarketLedger>("PlayerMarketLedger", ledgerSchema);
export const PlayerMarketCounter = model<IPlayerMarketCounter>("PlayerMarketCounter", counterSchema);

let stateIndexesReady: Promise<void> | undefined;

/** Remove the unique itemType index created by the old player-listing model. */
export const ensurePlayerMarketIndexes = (): Promise<void> => {
    stateIndexesReady ??= (async (): Promise<void> => {
        const indexes: Array<{ name?: string }> = (await PlayerMarketState.collection.listIndexes().toArray()) as unknown as Array<{ name?: string }>;
        const legacyIndex = indexes.find(index => index.name == "itemType_1");
        if (legacyIndex?.name) await PlayerMarketState.collection.dropIndex(legacyIndex.name);
        await PlayerMarketState.createIndexes();
    })().catch(error => {
        stateIndexesReady = undefined;
        throw error;
    });
    return stateIndexesReady;
};
