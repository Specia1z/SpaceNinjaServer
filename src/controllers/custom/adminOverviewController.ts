import type { RequestHandler } from "express";
import { Account } from "../../models/loginModel.ts";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { getAccountForRequest, isAdministrator } from "../../services/loginService.ts";

const inventoryFields = [
    "Suits", "SpaceSuits", "MechSuits", "Hoverboards", "Motorcycles", "CrewShips", "CrewShipHarnesses",
    "LongGuns", "Pistols", "Melee", "SpecialItems", "SentinelWeapons", "SpaceGuns", "SpaceMelee",
    "OperatorAmps", "DrifterGuns", "DrifterMelee", "DataKnives", "CrewShipWeapons", "CrewShipSalvagedWeapons",
    "Sentinels", "KubrowPets", "MoaPets", "Horses", "RawUpgrades", "Upgrades", "MiscItems", "OperatorSuits",
    "WeaponSkins", "Recipes", "Consumables", "LevelKeys", "Antiques", "Scoops"
] as const;

type AggregatedItem = { _id: string; ItemCount: number };

type AggregateTotals = {
    _id: null;
    RegularCredits: number;
    PremiumCredits: number;
    FusionPoints: number;
    CrewShipFusionPoints: number;
    PrimeTokens: number;
};

type AdminOverviewAggregate = {
    totals: AggregateTotals[];
    [key: string]: AggregatedItem[] | AggregateTotals[];
};

type AdminOverviewResponse = {
    scope: "allPlayers";
    generatedAt: string;
    players: {
        total: number;
        active: number;
        banned: number;
        withInventory: number;
    };
    inventory: Record<string, unknown> & {
        scope: "allPlayers";
        RegularCredits: number;
        PremiumCredits: number;
        FusionPoints: number;
        CrewShipFusionPoints: number;
        PrimeTokens: number;
    };
    stats: {
        inventoryRecords: number;
        inventoryQuantity: number;
        uniqueItemTypes: number;
        totalModInstances: number;
        uniqueModTypes: number;
        totalRawMods: number;
        uniqueRawModTypes: number;
    };
};

const getItemFacet = (field: string) => [
    { $unwind: `$${field}` },
    { $match: { [`${field}.ItemType`]: { $type: "string" } } },
    {
        $group: {
            _id: `$${field}.ItemType`,
            ItemCount: { $sum: { $ifNull: [`$${field}.ItemCount`, 1] } }
        }
    },
    { $sort: { ItemCount: -1, _id: 1 } }
];

const toInventoryItems = (items: AggregatedItem[]): { ItemType: string; ItemCount: number }[] =>
    items.map(item => ({ ItemType: item._id, ItemCount: item.ItemCount }));

export const getAdminOverviewController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) {
        res.status(403).send("Permission denied");
        return;
    }

    const facets = Object.fromEntries(inventoryFields.map(field => [field, getItemFacet(field)]));
    const [accounts, active, banned, withInventory, aggregate] = await Promise.all([
        Account.countDocuments(),
        Account.countDocuments({ LastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
        Account.countDocuments({ Banned: true }),
        Inventory.countDocuments({ accountOwnerId: { $exists: true } }),
        Inventory.aggregate<AdminOverviewAggregate>([
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                RegularCredits: { $sum: { $ifNull: ["$RegularCredits", 0] } },
                                PremiumCredits: { $sum: { $ifNull: ["$PremiumCredits", 0] } },
                                FusionPoints: { $sum: { $ifNull: ["$FusionPoints", 0] } },
                                CrewShipFusionPoints: { $sum: { $ifNull: ["$CrewShipFusionPoints", 0] } },
                                PrimeTokens: { $sum: { $ifNull: ["$PrimeTokens", 0] } }
                            }
                        }
                    ],
                    ...facets
                }
            }
        ])
    ]);

    const data = aggregate[0] ?? { totals: [] };
    const totals = data.totals[0] ?? {
        _id: null,
        RegularCredits: 0,
        PremiumCredits: 0,
        FusionPoints: 0,
        CrewShipFusionPoints: 0,
        PrimeTokens: 0
    };
    const itemLists = Object.fromEntries(
        inventoryFields.map(field => [field, toInventoryItems((data[field] as AggregatedItem[] | undefined) ?? [])])
    );
    const totalModInstances = itemLists.Upgrades?.reduce((sum, item) => sum + item.ItemCount, 0) ?? 0;
    const totalRawMods = itemLists.RawUpgrades?.reduce((sum, item) => sum + item.ItemCount, 0) ?? 0;
    const inventoryRecords = inventoryFields.reduce((sum, field) => sum + (itemLists[field]?.length ?? 0), 0);
    const inventoryQuantity = inventoryFields.reduce(
        (sum, field) => sum + (itemLists[field]?.reduce((fieldSum, item) => fieldSum + item.ItemCount, 0) ?? 0),
        0
    );

    const response: AdminOverviewResponse = {
        scope: "allPlayers",
        generatedAt: new Date().toISOString(),
        players: { total: accounts, active, banned, withInventory },
        inventory: {
            scope: "allPlayers",
            ...itemLists,
            RegularCredits: totals.RegularCredits,
            PremiumCredits: totals.PremiumCredits,
            FusionPoints: totals.FusionPoints,
            CrewShipFusionPoints: totals.CrewShipFusionPoints,
            PrimeTokens: totals.PrimeTokens
        },
        stats: {
            inventoryRecords,
            inventoryQuantity,
            uniqueItemTypes: inventoryRecords,
            totalModInstances,
            uniqueModTypes: itemLists.Upgrades?.length ?? 0,
            totalRawMods,
            uniqueRawModTypes: itemLists.RawUpgrades?.length ?? 0
        }
    };
    res.json(response);
};
