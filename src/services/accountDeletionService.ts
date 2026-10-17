import type { Types } from "mongoose";
import { CurrencyGrantStat } from "../models/currencyGrantStatModel.ts";
import { Friendship } from "../models/friendModel.ts";
import { GuildMember } from "../models/guildModel.ts";
import { Ignore, Account } from "../models/loginModel.ts";
import { Inbox } from "../models/inboxModel.ts";
import { InvasionRewardClaim } from "../models/invasionRewardClaimModel.ts";
import { Inventory } from "../models/inventoryModels/inventoryModel.ts";
import { Loadout } from "../models/inventoryModels/loadoutModel.ts";
import { Leaderboard } from "../models/leaderboardModel.ts";
import { PendingTrade } from "../models/tradingModel.ts";
import { PersonalRooms } from "../models/personalRoomsModel.ts";
import { PlayerMarketCounter, PlayerMarketLedger } from "../models/playerMarketModel.ts";
import { PlayerPresence, PlayerPresenceEvent } from "../models/presenceModel.ts";
import { PlayerSession } from "../models/playerSessionModel.ts";
import { Session } from "../models/sessionModel.ts";
import { Ship } from "../models/shipModel.ts";
import { SuspicionEvent } from "../models/suspicionEventModel.ts";
import { Stats } from "../models/statsModel.ts";
import { config } from "./configService.ts";
import { saveConfig } from "./configWriterService.ts";
import { deleteGuild } from "./guildService.ts";
import type { TAccountDocument } from "./loginService.ts";

const DOJO_KEY = "/Lotus/Types/Keys/DojoKey";
const DOJO_KEY_BLUEPRINT = "/Lotus/Types/Keys/DojoKeyBlueprint";

const clearAccountConfig = async (account: Pick<TAccountDocument, "_id" | "DisplayName">): Promise<void> => {
    const accountId = account._id.toString();
    let changed = false;

    if (config.administratorNames) {
        const administratorNames = config.administratorNames.filter(name => name != account.DisplayName);
        if (administratorNames.length != config.administratorNames.length) {
            config.administratorNames = administratorNames;
            changed = true;
        }
    }
    if (config.accountDropMultipliers && account.DisplayName in config.accountDropMultipliers) {
        delete config.accountDropMultipliers[account.DisplayName];
        changed = true;
    }
    if (config.accountRateProfiles && accountId in config.accountRateProfiles) {
        delete config.accountRateProfiles[accountId];
        changed = true;
    }
    if (config.accountFeatureProfiles && accountId in config.accountFeatureProfiles) {
        delete config.accountFeatureProfiles[accountId];
        changed = true;
    }

    if (changed) await saveConfig();
};

const clearGuildState = async (accountId: Types.ObjectId): Promise<void> => {
    const foundingMember = await GuildMember.findOne({ accountId, rank: 0, status: 0 }, "guildId");
    if (foundingMember) await deleteGuild(foundingMember.guildId);

    // Remove a non-founder from the guild inventory state as well. This also handles stale
    // memberships from older databases where the GuildMember row is already missing.
    await Inventory.updateOne(
        { accountOwnerId: accountId },
        {
            $unset: { GuildId: 1 },
            $pull: {
                LevelKeys: { ItemType: DOJO_KEY },
                Recipes: { ItemType: DOJO_KEY_BLUEPRINT }
            }
        }
    );
};

export const deleteAccountData = async (
    account: Pick<TAccountDocument, "_id" | "DisplayName" | "ReferredBy">
): Promise<void> => {
    const accountId = account._id;

    await clearAccountConfig(account);
    await clearGuildState(accountId);

    // Remove sessions created by the account before pulling it from sessions hosted by others.
    await Session.deleteMany({ creatorId: accountId });

    await Promise.all([
        account.ReferredBy
            ? Account.updateOne({ _id: account.ReferredBy, ReferralCount: { $gt: 0 } }, { $inc: { ReferralCount: -1 } })
            : Promise.resolve(),
        Account.updateMany(
            { ReferredBy: accountId },
            {
                $unset: {
                    ReferredBy: 1,
                    ReferralInviterReward: 1,
                    ReferralInviteeReward: 1,
                    ReferralMilestoneBonus: 1,
                    ReferralOnlineSeconds: 1,
                    ReferralOnlineStartedAt: 1,
                    ReferralQualifiedAt: 1,
                    ReferralRisk: 1
                }
            }
        ),
        Account.deleteOne({ _id: accountId }),
        CurrencyGrantStat.deleteMany({ AccountOwnerId: accountId }),
        Friendship.deleteMany({ $or: [{ owner: accountId }, { friend: accountId }] }),
        GuildMember.deleteMany({ accountId }),
        Ignore.deleteMany({ $or: [{ ignorer: accountId }, { ignoree: accountId }] }),
        Inbox.deleteMany({ ownerId: accountId }),
        InvasionRewardClaim.deleteMany({ accountId }),
        Inventory.deleteOne({ accountOwnerId: accountId }),
        Leaderboard.deleteMany({ ownerId: accountId }),
        Loadout.deleteOne({ loadoutOwnerId: accountId }),
        PendingTrade.deleteMany({ $or: [{ a: accountId }, { b: accountId }] }),
        PersonalRooms.deleteOne({ personalRoomsOwnerId: accountId }),
        PlayerMarketCounter.deleteMany({ scope: accountId.toString() }),
        PlayerMarketLedger.deleteMany({ accountId }),
        PlayerPresence.deleteOne({ AccountId: accountId }),
        PlayerPresenceEvent.deleteMany({ AccountId: accountId }),
        PlayerSession.deleteMany({ accountId }),
        Session.updateMany({ "members.accountId": accountId }, { $pull: { members: { accountId } } }),
        Ship.deleteMany({ ShipOwnerId: accountId }),
        Stats.deleteOne({ accountOwnerId: accountId }),
        SuspicionEvent.deleteMany({ AccountId: accountId })
    ]);
};
