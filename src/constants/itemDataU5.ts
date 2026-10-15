import type { TRarity } from "warframe-public-export-plus";

interface IU5FingerprintData {
    name?: string;
    fits: { type: string; rarity: TRarity; statAtten?: number }[];
    upgrades: IU5FingerprintUpgrade[];
    numUpgrades: {
        number: number;
        rarity: TRarity;
    }[];
}

export interface IU5FingerprintUpgrade {
    type: string;
    valueRarity: Record<Exclude<TRarity, "LEGENDARY">, [number, number]>;
    rarity: TRarity;
    operation: "MULTIPLY" | "ADD";
    displayAsPercent?: true;
}

const U5WeaponUpgrades: IU5FingerprintUpgrade[] = [
    {
        type: "WEAPON_DAMAGE_AMOUNT",
        valueRarity: {
            COMMON: [1.015, 1.15],
            UNCOMMON: [1.05, 1.25],
            RARE: [1.1, 1.5]
        },
        rarity: "COMMON",
        operation: "MULTIPLY"
    },
    {
        type: "WEAPON_FIRE_DAMAGE",
        valueRarity: {
            COMMON: [0.015, 0.15],
            UNCOMMON: [0.05, 0.25],
            RARE: [0.1, 0.5]
        },
        rarity: "RARE",
        operation: "ADD",
        displayAsPercent: true
    },
    {
        type: "WEAPON_ELECTRICITY_DAMAGE",
        valueRarity: {
            COMMON: [0.015, 0.15],
            UNCOMMON: [0.05, 0.25],
            RARE: [0.1, 0.5]
        },
        rarity: "COMMON",
        operation: "ADD",
        displayAsPercent: true
    },
    {
        type: "WEAPON_FREEZE_DAMAGE",
        valueRarity: {
            COMMON: [0.015, 0.15],
            UNCOMMON: [0.05, 0.25],
            RARE: [0.1, 0.5]
        },
        rarity: "COMMON",
        operation: "ADD",
        displayAsPercent: true
    },
    {
        type: "WEAPON_ARMOR_PIERCING_DAMAGE",
        valueRarity: {
            COMMON: [0.015, 0.15],
            UNCOMMON: [0.05, 0.25],
            RARE: [0.1, 0.5]
        },
        rarity: "COMMON",
        operation: "ADD",
        displayAsPercent: true
    },
    {
        type: "WEAPON_STUN_CHANCE",
        valueRarity: {
            COMMON: [0.025, 0.1],
            UNCOMMON: [0.05, 0.2],
            RARE: [0.1, 0.4]
        },
        rarity: "UNCOMMON",
        operation: "ADD",
        displayAsPercent: true
    },
    {
        type: "WEAPON_CLIP_MAX",
        valueRarity: {
            COMMON: [1.05, 1.35],
            UNCOMMON: [1.1, 1.5],
            RARE: [1.15, 2]
        },
        rarity: "UNCOMMON",
        operation: "MULTIPLY"
    },
    {
        type: "WEAPON_FIRE_ITERATIONS",
        valueRarity: {
            COMMON: [1.25, 1.75],
            UNCOMMON: [1.5, 2],
            RARE: [2, 4]
        },
        rarity: "RARE",
        operation: "MULTIPLY"
    },
    {
        type: "WEAPON_PUNCTURE_DEPTH",
        valueRarity: {
            COMMON: [2, 5],
            UNCOMMON: [2, 10],
            RARE: [3, 15]
        },
        rarity: "RARE",
        operation: "ADD"
    },
    {
        type: "WEAPON_AMMO_MAX",
        valueRarity: {
            COMMON: [1.05, 1.5],
            UNCOMMON: [1.1, 1.75],
            RARE: [1.15, 2]
        },
        rarity: "UNCOMMON",
        operation: "MULTIPLY"
    },
    {
        type: "WEAPON_RELOAD_SPEED",
        valueRarity: {
            COMMON: [1.05, 1.5],
            UNCOMMON: [1.075, 1.75],
            RARE: [1.1, 2]
        },
        rarity: "UNCOMMON",
        operation: "MULTIPLY"
    },
    {
        type: "WEAPON_FIRE_RATE",
        valueRarity: {
            COMMON: [1.01, 1.2],
            UNCOMMON: [1.05, 1.5],
            RARE: [1.1, 1.75]
        },
        rarity: "UNCOMMON",
        operation: "MULTIPLY"
    },
    {
        type: "WEAPON_CRIT_CHANCE",
        valueRarity: {
            COMMON: [0.0099999998, 0.1],
            UNCOMMON: [0.025, 0.15],
            RARE: [0.05, 0.2]
        },
        rarity: "COMMON",
        operation: "ADD",
        displayAsPercent: true
    },
    {
        type: "WEAPON_CRIT_DAMAGE",
        valueRarity: {
            COMMON: [0.1, 0.5],
            UNCOMMON: [0.2, 1],
            RARE: [0.3, 1.5]
        },
        rarity: "COMMON",
        operation: "ADD",
        displayAsPercent: true
    }
];

// couldn't find actual weights
export const U5ModsWeights: Record<TRarity, number> = {
    COMMON: 0.75,
    UNCOMMON: 0.2,
    RARE: 0.05,
    LEGENDARY: 0
};

export const U5Modules: Record<string, IU5FingerprintData> = {
    "/Lotus/Upgrades/Modules/Crafted/IncendiaryRifleMod": {
        name: "/Lotus/Language/Items/InfernoMod",
        fits: [
            {
                type: "/Lotus/Weapons/Tenno/Rifle/Rifle",
                rarity: "COMMON"
            }
        ],
        upgrades: [
            {
                type: "WEAPON_FIRE_DAMAGE",
                valueRarity: {
                    COMMON: [0.025, 0.3],
                    UNCOMMON: [0.05, 0.4],
                    RARE: [0.1, 0.7]
                },
                rarity: "COMMON",
                operation: "ADD",
                displayAsPercent: true
            }
        ],
        numUpgrades: [{ number: 1, rarity: "COMMON" }]
    },
    "/Lotus/Upgrades/Modules/GrineerMeleeModule": {
        fits: [
            {
                type: "/Lotus/Types/Game/LotusMeleeWeapon",
                rarity: "COMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/DualShortSword/DualShortSword",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/LongSword/LongSword",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/Staff/Staff",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/Fist/Fist",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/Dagger/Dagger",
                rarity: "UNCOMMON"
            }
        ],
        upgrades: [
            {
                type: "WEAPON_MELEE_DAMAGE",
                valueRarity: {
                    COMMON: [1.05, 1.15],
                    UNCOMMON: [1.075, 1.25],
                    RARE: [1.15, 1.5]
                },
                rarity: "COMMON",
                operation: "MULTIPLY"
            },
            {
                type: "WEAPON_FIRE_DAMAGE",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "RARE",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_ELECTRICITY_DAMAGE",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "COMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_FREEZE_DAMAGE",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "COMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_ARMOR_PIERCING_DAMAGE",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "COMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_STUN_CHANCE",
                valueRarity: {
                    COMMON: [0.05, 0.1],
                    UNCOMMON: [0.1, 0.2],
                    RARE: [0.2, 0.4]
                },
                rarity: "UNCOMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_CRIT_CHANCE",
                valueRarity: {
                    COMMON: [0.01, 0.1],
                    UNCOMMON: [0.02, 0.15],
                    RARE: [0.05, 0.25]
                },
                rarity: "COMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_CRIT_DAMAGE",
                valueRarity: {
                    COMMON: [0.05, 1],
                    UNCOMMON: [0.1, 1.5],
                    RARE: [0.2, 2]
                },
                rarity: "COMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_MELEE_HEAVY_DAMAGE",
                valueRarity: {
                    COMMON: [1.025, 1.25],
                    UNCOMMON: [1.05, 1.5],
                    RARE: [1.15, 1.75]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            },
            {
                type: "WEAPON_MELEE_CHARGE_RATE",
                valueRarity: {
                    COMMON: [0.025, 0.3],
                    UNCOMMON: [0.05, 0.4],
                    RARE: [0.1, 0.5]
                },
                rarity: "UNCOMMON",
                operation: "ADD",
                displayAsPercent: true
            },
            {
                type: "WEAPON_FIRE_RATE",
                valueRarity: {
                    COMMON: [1.05, 1.15],
                    UNCOMMON: [1.075, 1.35],
                    RARE: [1.1, 1.5]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            }
        ],
        numUpgrades: [
            { number: 1, rarity: "COMMON" },
            { number: 1, rarity: "RARE" }
        ]
    },
    "/Lotus/Upgrades/Modules/GrineerPistolModule": {
        fits: [
            {
                type: "/Lotus/Weapons/Tenno/Pistol/LotusPistol",
                rarity: "COMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Pistol/AutoPistol",
                rarity: "RARE"
            },
            {
                type: "/Lotus/Weapons/Tenno/Pistol/BurstPistol",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Pistol/CrossBow",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Pistol/HandShotGun",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Pistol/Pistol",
                rarity: "UNCOMMON"
            }
        ],
        upgrades: U5WeaponUpgrades,
        numUpgrades: [
            { number: 1, rarity: "COMMON" },
            { number: 1, rarity: "RARE" }
        ]
    },
    "/Lotus/Upgrades/Modules/GrineerRifleModule": {
        fits: [
            {
                type: "/Lotus/Weapons/Tenno/Rifle/LotusRifle",
                rarity: "COMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Rifle/BurstRifle",
                rarity: "UNCOMMON",
                statAtten: 1.2
            },
            {
                type: "/Lotus/Weapons/Tenno/Rifle/SniperRifle",
                rarity: "RARE",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Weapons/Tenno/Rifle/HeavyRifle",
                rarity: "RARE",
                statAtten: 1.3
            },
            {
                type: "/Lotus/Weapons/Tenno/Rifle/Rifle",
                rarity: "UNCOMMON",
                statAtten: 1.2
            },
            {
                type: "/Lotus/Weapons/Tenno/Rifle/SemiAutoRifle",
                rarity: "UNCOMMON",
                statAtten: 1.1
            }
        ],
        upgrades: U5WeaponUpgrades,
        numUpgrades: [
            { number: 1, rarity: "COMMON" },
            { number: 1, rarity: "RARE" }
        ]
    },
    "/Lotus/Upgrades/Modules/GrineerShotgunModule": {
        fits: [
            {
                type: "/Lotus/Weapons/Tenno/Shotgun/LotusShotgun",
                rarity: "COMMON",
                statAtten: 1
            },
            {
                type: "/Lotus/Weapons/Tenno/Shotgun/Shotgun",
                rarity: "UNCOMMON",
                statAtten: 1.2
            },
            {
                type: "/Lotus/Weapons/Tenno/Shotgun/FullAutoShotgun",
                rarity: "RARE",
                statAtten: 1.1
            }
        ],
        upgrades: U5WeaponUpgrades,
        numUpgrades: [
            { number: 1, rarity: "COMMON" },
            { number: 1, rarity: "RARE" }
        ]
    },
    "/Lotus/Upgrades/Modules/OrokinWarframeModule": {
        fits: [
            {
                type: "/Lotus/Types/Game/PowerSuit",
                rarity: "COMMON"
            },
            {
                type: "/Lotus/Powersuits/Ember/Ember",
                rarity: "UNCOMMON",
                statAtten: 1.2
            },
            {
                type: "/Lotus/Powersuits/Excalibur/Excalibur",
                rarity: "UNCOMMON",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Powersuits/Loki/Loki",
                rarity: "UNCOMMON",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Powersuits/Mag/Mag",
                rarity: "UNCOMMON",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Powersuits/Ninja/Ninja",
                rarity: "UNCOMMON",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Powersuits/Rhino/Rhino",
                rarity: "UNCOMMON",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Powersuits/Trinity/Trinity",
                rarity: "UNCOMMON",
                statAtten: 1.1
            },
            {
                type: "/Lotus/Powersuits/Volt/Volt",
                rarity: "UNCOMMON",
                statAtten: 1.1
            }
        ],
        upgrades: [
            {
                type: "AVATAR_SHIELD_MAX",
                valueRarity: {
                    COMMON: [1.05, 1.4],
                    UNCOMMON: [1.1, 1.7],
                    RARE: [1.2, 2]
                },
                rarity: "COMMON",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_ARMOUR",
                valueRarity: {
                    COMMON: [1.05, 1.4],
                    UNCOMMON: [1.1, 1.7],
                    RARE: [1.2, 2]
                },
                rarity: "COMMON",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_HEALTH_MAX",
                valueRarity: {
                    COMMON: [1.1, 1.4],
                    UNCOMMON: [1.15, 1.8],
                    RARE: [1.2, 2]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_POWER_MAX",
                valueRarity: {
                    COMMON: [1.05, 1.4],
                    UNCOMMON: [1.1, 1.75],
                    RARE: [1.15, 2]
                },
                rarity: "RARE",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_SHIELD_RECHARGE_RATE",
                valueRarity: {
                    COMMON: [1.05, 1.4],
                    UNCOMMON: [1.1, 1.75],
                    RARE: [1.15, 2]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            },
            {
                type: "WEAPON_MELEE_DAMAGE",
                valueRarity: {
                    COMMON: [1.05, 1.4],
                    UNCOMMON: [1.1, 1.75],
                    RARE: [1.15, 2]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_SPRINT_SPEED",
                valueRarity: {
                    COMMON: [1.03, 1.1],
                    UNCOMMON: [1.05, 1.25],
                    RARE: [1.1, 1.35]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_ENEMY_RADAR",
                valueRarity: {
                    COMMON: [15, 20],
                    UNCOMMON: [20, 40],
                    RARE: [25, 60]
                },
                rarity: "RARE",
                operation: "ADD"
            },
            {
                type: "AVATAR_LOOT_RADAR",
                valueRarity: {
                    COMMON: [15, 20],
                    UNCOMMON: [20, 40],
                    RARE: [25, 60]
                },
                rarity: "UNCOMMON",
                operation: "ADD"
            },
            {
                type: "AVATAR_ABILITY_RANGE",
                valueRarity: {
                    COMMON: [1.05, 1.4],
                    UNCOMMON: [1.1, 1.5],
                    RARE: [1.15, 1.8]
                },
                rarity: "UNCOMMON",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_ABILITY_DURATION",
                valueRarity: {
                    COMMON: [1.02, 1.3],
                    UNCOMMON: [1.05, 1.4],
                    RARE: [1.05, 1.5]
                },
                rarity: "RARE",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_ABILITY_EFFICIENCY",
                valueRarity: {
                    COMMON: [1.03, 1.3],
                    UNCOMMON: [1.05, 1.5],
                    RARE: [1.1, 1.7]
                },
                rarity: "RARE",
                operation: "MULTIPLY"
            },
            {
                type: "AVATAR_ABILITY_STRENGTH",
                valueRarity: {
                    COMMON: [1.03, 1.4],
                    UNCOMMON: [1.05, 1.5],
                    RARE: [1.1, 1.7]
                },
                rarity: "RARE",
                operation: "MULTIPLY"
            }
        ],
        numUpgrades: [
            { number: 1, rarity: "COMMON" },
            { number: 1, rarity: "RARE" }
        ]
    },
    "/Lotus/Upgrades/Modules/TennoSwordModule": {
        fits: [
            {
                type: "/Lotus/Types/Game/LotusMeleeWeapon",
                rarity: "COMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/DualShortSword/DualShortSword",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/LongSword/LongSword",
                rarity: "UNCOMMON"
            },
            {
                type: "/Lotus/Weapons/Tenno/Melee/Staff/Staff",
                rarity: "UNCOMMON"
            }
        ],
        upgrades: [
            {
                type: "WEAPON_MELEE_DAMAGE",
                operation: "MULTIPLY",
                valueRarity: {
                    COMMON: [1.05, 1.15],
                    UNCOMMON: [1.075, 1.25],
                    RARE: [1.15, 1.5]
                },
                rarity: "COMMON"
            },
            {
                type: "WEAPON_FIRE_DAMAGE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "RARE",
                displayAsPercent: true
            },
            {
                type: "WEAPON_ELECTRICITY_DAMAGE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "COMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_FREEZE_DAMAGE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "COMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_ARMOR_PIERCING_DAMAGE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.05, 0.15],
                    UNCOMMON: [0.075, 0.25],
                    RARE: [0.1, 0.5]
                },
                rarity: "COMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_STUN_CHANCE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.05, 0.1],
                    UNCOMMON: [0.1, 0.2],
                    RARE: [0.2, 0.4]
                },
                rarity: "UNCOMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_CRIT_CHANCE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.01, 0.1],
                    UNCOMMON: [0.02, 0.15],
                    RARE: [0.05, 0.25]
                },
                rarity: "COMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_CRIT_DAMAGE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.05, 1],
                    UNCOMMON: [0.1, 1.5],
                    RARE: [0.2, 2]
                },
                rarity: "COMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_MELEE_HEAVY_DAMAGE",
                operation: "MULTIPLY",
                valueRarity: {
                    COMMON: [1.025, 1.25],
                    UNCOMMON: [1.05, 1.5],
                    RARE: [1.15, 1.75]
                },
                rarity: "UNCOMMON"
            },
            {
                type: "WEAPON_MELEE_CHARGE_RATE",
                operation: "ADD",
                valueRarity: {
                    COMMON: [0.025, 0.3],
                    UNCOMMON: [0.05, 0.4],
                    RARE: [0.1, 0.5]
                },
                rarity: "UNCOMMON",
                displayAsPercent: true
            },
            {
                type: "WEAPON_FIRE_RATE",
                operation: "MULTIPLY",
                valueRarity: {
                    COMMON: [1.05, 1.15],
                    UNCOMMON: [1.075, 1.35],
                    RARE: [1.1, 1.5]
                },
                rarity: "UNCOMMON"
            }
        ],
        numUpgrades: [
            { number: 1, rarity: "COMMON" },
            { number: 1, rarity: "RARE" }
        ]
    }
};
