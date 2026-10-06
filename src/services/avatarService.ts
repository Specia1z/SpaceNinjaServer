import { ExportFlavour } from "warframe-public-export-plus";

const DEFAULT_AVATAR_IMAGE_TYPE = "/Lotus/Types/StoreItems/AvatarImages/AvatarImageDefault";
const DEFAULT_AVATAR_ICON = "/Lotus/Interface/Icons/Player/LotusSymbol.png";

export const getAvatarIcon = (avatarImageType?: string): string => {
    const flavourByName = ExportFlavour as Record<string, { icon?: string } | undefined>;
    const requestedType = avatarImageType || DEFAULT_AVATAR_IMAGE_TYPE;
    return flavourByName[requestedType]?.icon ?? flavourByName[DEFAULT_AVATAR_IMAGE_TYPE]?.icon ?? DEFAULT_AVATAR_ICON;
};
