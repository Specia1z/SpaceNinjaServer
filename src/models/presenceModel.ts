import { model, Schema } from "mongoose";
import type { Types } from "mongoose";

export const presenceStates = [
    "offline",
    "online",
    "authenticating",
    "lobby",
    "mission",
    "hub",
    "relay",
    "unknown"
] as const;

export type TPresenceState = (typeof presenceStates)[number];

export interface IPlayerPresence {
    AccountId: Types.ObjectId;
    DisplayName: string;
    Online: boolean;
    State: TPresenceState;
    BuildLabel?: string;
    Platform?: number;
    SessionId?: string;
    SessionRole?: string;
    SessionGameModeId?: number;
    SessionRegionId?: number;
    SessionMap?: string;
    SessionMemberCount?: number;
    Node?: string;
    NodeName?: string;
    Planet?: string;
    MissionStatus?: string;
    MissionType?: string;
    MissionTime?: number;
    AliveTime?: number;
    LastMissionAt?: Date;
    LastLoginAt?: Date;
    LastLogoutAt?: Date;
    LastSeenAt: Date;
    UpdatedAt: Date;
}

export interface IPlayerPresenceEvent {
    AccountId: Types.ObjectId;
    DisplayName: string;
    Type: string;
    State: TPresenceState;
    Online: boolean;
    Node?: string;
    NodeName?: string;
    Planet?: string;
    SessionId?: string;
    MissionStatus?: string;
    Details?: Record<string, unknown>;
    CreatedAt: Date;
}

const presenceSchema = new Schema<IPlayerPresence>({
    AccountId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    DisplayName: { type: String, required: true },
    Online: { type: Boolean, required: true, default: false, index: true },
    State: { type: String, required: true, enum: presenceStates, default: "offline", index: true },
    BuildLabel: String,
    Platform: Number,
    SessionId: String,
    SessionRole: String,
    SessionGameModeId: Number,
    SessionRegionId: Number,
    SessionMap: String,
    SessionMemberCount: Number,
    Node: String,
    NodeName: String,
    Planet: String,
    MissionStatus: String,
    MissionType: String,
    MissionTime: Number,
    AliveTime: Number,
    LastMissionAt: Date,
    LastLoginAt: Date,
    LastLogoutAt: Date,
    LastSeenAt: { type: Date, required: true, index: true },
    UpdatedAt: { type: Date, required: true }
});

const presenceEventSchema = new Schema<IPlayerPresenceEvent>({
    AccountId: { type: Schema.Types.ObjectId, required: true, index: true },
    DisplayName: { type: String, required: true },
    Type: { type: String, required: true },
    State: { type: String, required: true, enum: presenceStates },
    Online: { type: Boolean, required: true },
    Node: String,
    NodeName: String,
    Planet: String,
    SessionId: String,
    MissionStatus: String,
    Details: { type: Schema.Types.Mixed },
    CreatedAt: { type: Date, required: true, default: (): Date => new Date(), index: true }
});

presenceEventSchema.index({ AccountId: 1, CreatedAt: -1 });

export const PlayerPresence = model<IPlayerPresence>("PlayerPresence", presenceSchema);
export const PlayerPresenceEvent = model<IPlayerPresenceEvent>("PlayerPresenceEvent", presenceEventSchema);
