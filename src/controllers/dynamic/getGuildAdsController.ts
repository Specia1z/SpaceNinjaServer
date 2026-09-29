import { GuildAd } from "../../models/guildModel.ts";
import {
    buildGuildAdSearchQuery,
    guildAdMatchesFeatures,
    parseGuildAdSearchOptions,
    toGuildAdInfoClient
} from "../../services/guildAdvertisementService.ts";
import type { RequestHandler } from "express";

export const getGuildAdsController: RequestHandler = async (req, res) => {
    const options = parseGuildAdSearchOptions(req.query);
    const query = GuildAd.find(buildGuildAdSearchQuery(options)).sort({ Expiry: -1, MemberCount: -1, GuildName: 1 });
    const ads = await query;
    const matchingAds = ads.filter(ad => guildAdMatchesFeatures(ad, options.features));
    const guildAdInfos = (options.limit === undefined ? matchingAds : matchingAds.slice(0, options.limit)).map(
        toGuildAdInfoClient
    );
    res.json({
        GuildAdInfos: guildAdInfos
    });
};
