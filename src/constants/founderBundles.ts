import type { IBundle } from "warframe-public-export-plus";

export type TFounderTier = 1 | 2 | 3 | 4;

export interface IFounderBundleDefinition extends IBundle {
    typeName: string;
    tier: TFounderTier;
    price: number;
    localizeTag: string;
    localizeDescTag: string;
    icon: string;
    titleTypeName: string;
}

const STORE_ITEMS = "/Lotus/StoreItems";

const founderBundleDefinitions: readonly IFounderBundleDefinition[] = [
    {
        typeName: "/Lotus/Types/StoreItems/Packages/CompleteStarterSlotBundle",
        tier: 1,
        price: 45,
        localizeTag: "/Lotus/Language/Titles/Founder1_MarketTitle",
        localizeDescTag: "/Lotus/Language/Items/FoundersBadgeDiscipleDesc",
        icon: "/Lotus/Interface/Icons/StoreIcons/Emblems/FoundersBadgeDiscipleHolo.png",
        titleTypeName: "/Lotus/Types/Items/Titles/FounderLvl1Title",
        components: [
            {
                typeName: `${STORE_ITEMS}/Upgrades/Skins/Clan/FoundersBadgeDiscipleItem`,
                purchaseQuantity: 1
            }
        ],
        oneTimePurchasable: true,
        platinumCost: 45
    },
    {
        typeName: "/Lotus/Types/StoreItems/Packages/CompleteUpgradeBundle",
        tier: 2,
        price: 90,
        localizeTag: "/Lotus/Language/Titles/Founder2_MarketTitle",
        localizeDescTag: "/Lotus/Language/Items/FoundersBadgeHunterDesc",
        icon: "/Lotus/Interface/Icons/StoreIcons/Emblems/FoundersBadgeHunterHolo.png",
        titleTypeName: "/Lotus/Types/Items/Titles/FounderLvl2Title",
        components: [
            {
                typeName: `${STORE_ITEMS}/Upgrades/Skins/Clan/FoundersBadgeHunterItem`,
                purchaseQuantity: 1
            },
            {
                typeName: `${STORE_ITEMS}/Powersuits/Excalibur/ExcaliburPrime`,
                purchaseQuantity: 1
            }
        ],
        oneTimePurchasable: true,
        platinumCost: 90
    },
    {
        typeName: "/Lotus/Types/StoreItems/Packages/NecramechEssentialModBundle",
        tier: 3,
        price: 125,
        localizeTag: "/Lotus/Language/Titles/Founder3_MarketTitle",
        localizeDescTag: "/Lotus/Language/Items/FoundersBadgeMasterDesc",
        icon: "/Lotus/Interface/Icons/StoreIcons/Emblems/FoundersBadgeMasterHolo.png",
        titleTypeName: "/Lotus/Types/Items/Titles/FounderLvl3Title",
        components: [
            {
                typeName: `${STORE_ITEMS}/Upgrades/Skins/Clan/FoundersBadgeMasterItem`,
                purchaseQuantity: 1
            },
            {
                typeName: `${STORE_ITEMS}/Powersuits/Excalibur/ExcaliburPrime`,
                purchaseQuantity: 1
            },
            {
                typeName: `${STORE_ITEMS}/Weapons/Tenno/Melee/LongSword/SkanaPrime`,
                purchaseQuantity: 1
            }
        ],
        oneTimePurchasable: true,
        platinumCost: 125
    },
    {
        typeName: "/Lotus/Types/StoreItems/Packages/CompleteBoosterBundle",
        tier: 4,
        price: 500,
        localizeTag: "/Lotus/Language/Titles/Founder4_MarketTitle",
        localizeDescTag: "/Lotus/Language/Items/FoundersBadgeGrandMasterDesc",
        icon: "/Lotus/Interface/Icons/StoreIcons/Emblems/FoundersBadgeGrandMasterHolo.png",
        titleTypeName: "/Lotus/Types/Items/Titles/FounderLvl4Title",
        components: [
            {
                typeName: `${STORE_ITEMS}/Upgrades/Skins/Clan/FoundersBadgeGrandMasterItem`,
                purchaseQuantity: 1
            },
            {
                typeName: `${STORE_ITEMS}/Powersuits/Excalibur/ExcaliburPrime`,
                purchaseQuantity: 1
            },
            {
                typeName: `${STORE_ITEMS}/Weapons/Tenno/Melee/LongSword/SkanaPrime`,
                purchaseQuantity: 1
            },
            {
                typeName: `${STORE_ITEMS}/Weapons/Tenno/Pistol/LatoPrime`,
                purchaseQuantity: 1
            }
        ],
        oneTimePurchasable: true,
        platinumCost: 500
    }
];

export const FOUNDER_BUNDLES = founderBundleDefinitions;

export const founderBundles: Record<string, IBundle> = Object.fromEntries(
    founderBundleDefinitions.map(definition => [definition.typeName, definition])
);

export const getFounderBundle = (typeName: string): IFounderBundleDefinition | undefined => {
    const key = typeName.startsWith("/Lotus/StoreItems/")
        ? `/Lotus/Types/StoreItems/${typeName.substring("/Lotus/StoreItems/".length)}`
        : typeName;
    return founderBundleDefinitions.find(definition => definition.typeName == key);
};

const metadataComponent = (component: IBundle["components"][number]): string =>
    `{\nTypeName=${component.typeName}\nPurchaseQuantity=${component.purchaseQuantity}\nDurability=COMMON\nGiveMaxRank=0\n}`;

export interface IFounderMetadataState {
    price: number;
    listed: boolean;
}

export const createFounderMetadataPatchText = (
    getState: (definition: IFounderBundleDefinition) => IFounderMetadataState = definition => ({
        price: definition.price,
        listed: true
    })
): string =>
    founderBundleDefinitions
        .map(definition => {
            const state = getState(definition);
            const components = definition.components.map(metadataComponent).join(",\n");
            return [
                definition.typeName,
                "$clear",
                `LocalizeTag=${definition.localizeTag}`,
                `LocalizeDescTag=${definition.localizeDescTag}`,
                `Icon=${definition.icon}`,
                "ProductCategory=Packages",
                `ShowInMarket=${state.listed ? 1 : 0}`,
                "ExcludeFromCodex=0",
                "OneTimePurchasable=1",
                "AutoCalcPrices=0",
                `PremiumPrice=${state.price}`,
                `PackageComponents={\n${components}\n}`,
                ""
            ].join("\n");
        })
        .join("\n");

export const founderMetadataPatchText = createFounderMetadataPatchText();
