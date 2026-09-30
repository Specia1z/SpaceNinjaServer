import { model, Schema, type Types } from "mongoose";

interface IPlayerSession {
    accountId: Types.ObjectId;
    tokenHash: string;
    passwordVersion: number;
    expiresAt: Date;
}

const schema = new Schema<IPlayerSession>({
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    passwordVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true }
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PlayerSession = model<IPlayerSession>("PlayerSession", schema);
