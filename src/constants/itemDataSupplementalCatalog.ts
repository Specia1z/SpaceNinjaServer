import type { IKey, IPowersuit, IUpgrade } from "warframe-public-export-plus";

export const supplementalSuits: Record<string, IPowersuit> = {
    "/Lotus/Powersuits/Duelist/Duelist": {
        name: "Narin",
        parentName: "/Lotus/Powersuits/Duelist/DuelistBaseSuit",
        description: "Narin descends in swirling eddies, her blade keen and deadly as an icy wind.",
        icon: "/Lotus/Interface/Icons/StoreIcons/Warframes/Narin.png",
        health: 270,
        shield: 550,
        armor: 165,
        stamina: 3,
        power: 200,
        codexSecret: false,
        masteryReq: 0,
        sprintSpeed: 1.1,
        passiveDescription:
            "Each stack of Cold Status Effect on enemies increases the chance to spawn Sangodae pickups. Narin also gains Cold Damage for her abilities.",
        abilities: [
            {
                uniqueName: "/Lotus/Powersuits/Duelist/Abilities/DuelistThrustAbility",
                name: "Neote",
                description: "Lunge with Narin's ice rapier, inflicting Cold and Puncture Status Effects.",
                icon: "/Lotus/Interface/Icons/Abilities/NarinThrust.png",
                energyRequiredToActivate: 25
            },
            {
                uniqueName: "/Lotus/Powersuits/Duelist/Abilities/DuelistRiposteAbility",
                name: "Naraemagi",
                description: "Recover Shields by absorbing Cold Status from nearby enemies.",
                icon: "/Lotus/Interface/Icons/Abilities/NarinRiposte.png",
                energyRequiredToActivate: 50
            },
            {
                uniqueName: "/Lotus/Powersuits/Duelist/Abilities/DuelistLeapAbility",
                name: "Hakchum",
                description: "Leap through the air and apply Cold Damage Vulnerability upon landing.",
                icon: "/Lotus/Interface/Icons/Abilities/NarinLeap.png",
                energyRequiredToActivate: 75
            },
            {
                uniqueName: "/Lotus/Powersuits/Duelist/Abilities/DuelistBladeDanceAbility",
                name: "Nurinarim",
                description: "Summon an ancestral spirit for continuous nearby Cold Damage.",
                icon: "/Lotus/Interface/Icons/Abilities/NarinBladeDance.png",
                energyRequiredToActivate: 100
            }
        ],
        productCategory: "Suits",
        variantType: "VT_NORMAL",
        platinumCost: 370,
        introducedAt: 1758585600
    },
    "/Lotus/Powersuits/Excalibur/DarkExcalibur": {
        name: "/Lotus/Language/Changyou/DarkExcaliburName",
        parentName: "/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit",
        description: "/Lotus/Language/Suits/DarkExcaliburDesc",
        icon: "/Lotus/Interface/Icons/Store/DarkExcalibur.png",
        health: 270,
        shield: 270,
        armor: 315,
        stamina: 3,
        power: 175,
        codexSecret: true,
        masteryReq: 0,
        longDescription: "/Lotus/Language/Codex/DarkExcaliburLongDesc",
        sprintSpeed: 1,
        passiveDescription: "/Lotus/Language/Suits/ExcaliburPassiveAbility",
        exalted: ["/Lotus/Powersuits/Excalibur/DoomSwordCYUmbra"],
        abilities: [
            {
                uniqueName: "/Lotus/Powersuits/Excalibur/Abilities/SlashDashNewAbility",
                name: "/Lotus/Language/Suits/SlashDashAbilityName",
                description: "/Lotus/Language/Suits/SlashDashAbilityDesc",
                icon: "/Lotus/Interface/Icons/Abilities/Power04.png",
                energyRequiredToActivate: 25
            },
            {
                uniqueName: "/Lotus/Powersuits/Excalibur/Abilities/RadialBlindAbility",
                name: "/Lotus/Language/Suits/RadialBlindAbilityName",
                description: "/Lotus/Language/Suits/RadialBlindAbilityDesc",
                icon: "/Lotus/Interface/Icons/Abilities/Power01.png",
                energyRequiredToActivate: 50
            },
            {
                uniqueName: "/Lotus/Powersuits/Excalibur/Abilities/RadialJavelinAbility",
                name: "/Lotus/Language/Suits/RadialJavelinAbilityName",
                description: "/Lotus/Language/Suits/RadialJavelinAbilityDesc",
                icon: "/Lotus/Interface/Icons/Abilities/Power03.png",
                energyRequiredToActivate: 75
            },
            {
                uniqueName: "/Lotus/Powersuits/Excalibur/Abilities/SwordOfDoomAbility",
                name: "/Lotus/Language/Suits/SwordOfDoomAbilityName",
                description: "/Lotus/Language/Suits/SwordOfDoomAbilityDesc",
                icon: "/Lotus/Interface/Icons/Abilities/ExcaliburSwordOfDoom.png",
                energyRequiredToActivate: 25,
                energyConsumptionOverTime: 2.5
            }
        ],
        productCategory: "Suits",
        variantType: "VT_VARIANT",
        additionalItems: [
            "/Lotus/Upgrades/Skins/Excalibur/ExcaliburUmbraHelmet",
            "/Lotus/Powersuits/Excalibur/DoomSwordCYUmbra"
        ],
        excludeFromMarket: true,
        introducedAt: 1519338301
    },
    "/Lotus/Powersuits/Stalker/Stalker": {
        name: "/Lotus/Language/Game/Stalker",
        parentName: "/Lotus/Types/Game/PowerSuits/PlayerPowerSuit",
        description: "/Lotus/Language/Enemies/StalkerDesc",
        icon: "/Lotus/Interface/Icons/StoreIcons/MiscItems/Stalker.png",
        health: 455,
        shield: 180,
        armor: 135,
        stamina: 3,
        power: 100,
        codexSecret: true,
        masteryReq: 0,
        longDescription: "/Lotus/Language/Enemies/StalkerDesc",
        sprintSpeed: 1.2,
        passiveDescription: "/Lotus/Language/Suits/StalkerPassiveAbility",
        abilities: [
            {
                uniqueName: "/Lotus/Powersuits/Stalker/Abilities/StalkerTeleportToAbility",
                name: "/Lotus/Language/Suits/StalkerTeleportName",
                description: "/Lotus/Language/Suits/StalkerTeleportDesc",
                icon: "/Lotus/Interface/Icons/Abilities/StalkerTeleport.png",
                energyRequiredToActivate: 25
            },
            {
                uniqueName: "/Lotus/Powersuits/Stalker/Abilities/StalkerStunAbility",
                name: "/Lotus/Language/Suits/StalkerStunName",
                description: "/Lotus/Language/Suits/StalkerStunDescription",
                icon: "/Lotus/Interface/Icons/Abilities/StalkerMarkedVengeance.png",
                energyRequiredToActivate: 50
            },
            {
                uniqueName: "/Lotus/Powersuits/Stalker/Abilities/StalkerSmokeScreenAbility",
                name: "/Lotus/Language/Suits/StalkerSmokeScreenName",
                description: "/Lotus/Language/Suits/StalkerSmokeScreenDesc",
                icon: "/Lotus/Interface/Icons/Abilities/StalkerSmokeScreen.png",
                energyRequiredToActivate: 75
            },
            {
                uniqueName: "/Lotus/Powersuits/Stalker/Abilities/StalkerAbsorbAbility",
                name: "/Lotus/Language/Suits/StalkerAbsorbAbilityName",
                description: "/Lotus/Language/Suits/StalkerAbsorbAbilityDesc",
                icon: "/Lotus/Interface/Icons/Abilities/StalkerAbsorbProjectile.png",
                energyRequiredToActivate: 100
            }
        ],
        productCategory: "Suits",
        variantType: "VT_NORMAL",
        excludeFromMarket: true,
        introducedAt: 1687359253
    }
};

export const supplementalUpgrades: Record<string, IUpgrade> = {
    // removed in 2017.03.06.29.02.13
    "/Lotus/Upgrades/Mods/Aura/PlayerElectricityImmunityAuraMod": {
        name: "/Lotus/Language/Items/PlayerElectricityImmunityBuffName",
        icon: "/Lotus/Interface/Cards/Images/MissionBuffs/PlayerElectricityImmunityBuff.png",
        polarity: "AP_ANY", // it should be none
        rarity: "UNCOMMON",
        codexSecret: true,
        baseDrain: -2,
        fusionLimit: 5,
        compat: "/Lotus/Types/Game/PowerSuits/PlayerPowerSuit",
        compatName: "AURA",
        type: "AURA",
        description: "/Lotus/Language/Items/PlayerElectricityImmunityBuffDesc",
        isFrivolous: true,
        tradable: false
    },
    // removed in 2017.03.06.29.02.13
    "/Lotus/Upgrades/Mods/Aura/PlayerFireImmunityAuraMod": {
        name: "/Lotus/Language/Items/PlayerFireImmunityBuffName",
        icon: "/Lotus/Interface/Cards/Images/MissionBuffs/PlayerFireImmunityBuff.png",
        polarity: "AP_ANY", // it should be none
        rarity: "UNCOMMON",
        codexSecret: true,
        baseDrain: -2,
        fusionLimit: 5,
        compat: "/Lotus/Types/Game/PowerSuits/PlayerPowerSuit",
        compatName: "AURA",
        type: "AURA",
        description: "/Lotus/Language/Items/PlayerFireImmunityBuffDesc",
        isFrivolous: true,
        tradable: false
    },
    // removed in 2017.03.06.29.02.13
    "/Lotus/Upgrades/Mods/Aura/PlayerFreezeImmunityAuraMod": {
        name: "/Lotus/Language/Items/PlayerFreezeImmunityBuffName",
        icon: "/Lotus/Interface/Cards/Images/MissionBuffs/PlayerFreezeImmunityBuff.png",
        polarity: "AP_ANY", // it should be none
        rarity: "UNCOMMON",
        codexSecret: true,
        baseDrain: -2,
        fusionLimit: 5,
        compat: "/Lotus/Types/Game/PowerSuits/PlayerPowerSuit",
        compatName: "AURA",
        type: "AURA",
        description: "/Lotus/Language/Items/PlayerFreezeImmunityBuffDesc",
        isFrivolous: true,
        tradable: false
    },
    // removed in 2017.03.06.29.02.13
    "/Lotus/Upgrades/Mods/Aura/PlayerLaserImmunityAuraMod": {
        name: "/Lotus/Language/Items/PlayerLaserImmunityBuffName",
        icon: "/Lotus/Interface/Cards/Images/MissionBuffs/PlayerLaserImmunityBuff.png",
        polarity: "AP_ANY", // it should be none
        rarity: "UNCOMMON",
        codexSecret: true,
        baseDrain: -2,
        fusionLimit: 5,
        compat: "/Lotus/Types/Game/PowerSuits/PlayerPowerSuit",
        compatName: "AURA",
        type: "AURA",
        description: "/Lotus/Language/Items/PlayerLaserImmunityBuffDesc",
        isFrivolous: true,
        tradable: false
    },
    // removed in 2015.12.05.18.07
    "/Lotus/Upgrades/Mods/Aura/PlayerXPAuraMod": {
        name: "/Lotus/Language/Items/PlayerXPBuffName",
        icon: "/Lotus/Interface/Cards/Images/MissionBuffs/PlayerXPBuff.png",
        polarity: "AP_TACTIC",
        rarity: "UNCOMMON",
        codexSecret: true,
        baseDrain: -2,
        fusionLimit: 5,
        compat: "/Lotus/Types/Game/PowerSuits/PlayerPowerSuit",
        compatName: "AURA",
        type: "AURA",
        description: "/Lotus/Language/Items/PlayerXPBuffDesc",
        isFrivolous: true,
        tradable: false
    }
};

export const supplementalKeys: Record<string, IKey> = {
    "/Lotus/Types/Keys/TauPrologue/TauPrologueAStage1Lua": {
        name: "/Lotus/Language/TauPrologue/QuestPartAStage1",
        parentName: "/Lotus/Types/Game/KeyItem",
        codexSecret: true,
        mission: {}
    },
    "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainA": {
        name: "/Lotus/Language/TauPrologue/QuestPartATitle",
        description: "/Lotus/Language/TauPrologue/QuestPartADesc",
        parentName: "/Lotus/Types/Game/KeyChainItem",
        codexSecret: false,
        replayable: true,
        chainStages: [
            {
                key: "/Lotus/Types/Keys/TauPrologue/TauPrologueAStage1Lua",
                itemsToGiveWhenTriggered: []
            },
            {
                itemsToGiveWhenTriggered: []
            }
        ]
    },
    "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainB": {
        name: "/Lotus/Language/TauPrologue/QuestPartBTitle",
        description: "/Lotus/Language/TauPrologue/QuestPartBDesc",
        parentName: "/Lotus/Types/Game/KeyChainItem",
        codexSecret: false,
        replayable: true,
        chainStages: [{ itemsToGiveWhenTriggered: [] }]
    },
    "/Lotus/Types/Keys/TauPrologue/TauPrologueKeyChainC": {
        name: "/Lotus/Language/TauPrologue/QuestPartCTitle",
        description: "/Lotus/Language/TauPrologue/QuestPartCDesc",
        parentName: "/Lotus/Types/Game/KeyChainItem",
        codexSecret: false,
        replayable: true,
        chainStages: [{ itemsToGiveWhenTriggered: [] }]
    },
    "/Lotus/Types/Keys/RaidKeys/Raid01Stage01KeyItem": {
        name: "/Lotus/Language/Items/GrineerTrialsName",
        description: "/Lotus/Language/Items/GrineerTrialsDesc",
        icon: "/Lotus/Interface/Quests/GrineerRaidKeyChain.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        mission: {
            minEnemyLevel: 70,
            maxEnemyLevel: 80
        }
    },
    "/Lotus/Types/Keys/RaidKeys/Raid01Stage01NightmareKeyItem": {
        name: "/Lotus/Language/Items/GrineerTrialsName",
        description: "/Lotus/Language/Items/GrineerTrialsDesc",
        icon: "/Lotus/Interface/Quests/GrineerRaidKeyChain.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        mission: {
            minEnemyLevel: 70,
            maxEnemyLevel: 80
        }
    },
    "/Lotus/Types/Keys/RaidKeys/Raid01Stage02KeyItem": {
        name: "/Lotus/Language/Items/GrineerTrialsName",
        description: "/Lotus/Language/Items/GrineerTrialsDesc",
        icon: "/Lotus/Interface/Quests/GrineerRaidKeyChain.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        mission: {
            minEnemyLevel: 80,
            maxEnemyLevel: 90
        }
    },
    "/Lotus/Types/Keys/RaidKeys/Raid01Stage02NightmareKeyItem": {
        name: "/Lotus/Language/Items/GrineerTrialsName",
        description: "/Lotus/Language/Items/GrineerTrialsDesc",
        icon: "/Lotus/Interface/Quests/GrineerRaidKeyChain.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        mission: {
            minEnemyLevel: 80,
            maxEnemyLevel: 90
        }
    },
    "/Lotus/Types/Keys/RaidKeys/Raid01Stage03KeyItem": {
        name: "/Lotus/Language/Items/GrineerTrialsName",
        description: "/Lotus/Language/Items/GrineerTrialsDesc",
        icon: "/Lotus/Interface/Quests/GrineerRaidKeyChain.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        missionReward: {
            credits: 200000,
            droptable: "/Lotus/Types/Game/MissionDecks/RaidRewards/HekRaid"
        },
        mission: {
            minEnemyLevel: 80,
            maxEnemyLevel: 100
        }
    },
    "/Lotus/Types/Keys/RaidKeys/Raid01Stage03NightmareKeyItem": {
        name: "/Lotus/Language/Items/GrineerNightmareTrialsName",
        description: "/Lotus/Language/Items/GrineerTrialsDesc",
        icon: "/Lotus/Interface/Quests/GrineerRaidKeyChain.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        missionReward: {
            credits: 250000,
            droptable: "/Lotus/Types/Game/MissionDecks/RaidRewards/NightmareHekRaid"
        },
        mission: {
            minEnemyLevel: 80,
            maxEnemyLevel: 100
        }
    },
    "/Lotus/Types/Keys/RaidKeys/RaidGolemStage01KeyItem": {
        name: "/Lotus/Language/Items/GolemTrialsName",
        description: "/Lotus/Language/Items/GolemTrialsDesc",
        icon: "/Lotus/Interface/Icons/Store/GolemRaidKey.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        mission: {
            minEnemyLevel: 86,
            maxEnemyLevel: 88
        }
    },
    "/Lotus/Types/Keys/RaidKeys/RaidGolemStage02KeyItem": {
        name: "/Lotus/Language/Items/GolemTrialsName",
        description: "/Lotus/Language/Items/GolemTrialsDesc",
        icon: "/Lotus/Interface/Icons/Store/GolemRaidKey.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        mission: {
            minEnemyLevel: 88,
            maxEnemyLevel: 92
        }
    },
    "/Lotus/Types/Keys/RaidKeys/RaidGolemStage03KeyItem": {
        name: "/Lotus/Language/Items/GolemTrialsName",
        description: "/Lotus/Language/Items/GolemTrialsDesc",
        icon: "/Lotus/Interface/Icons/Store/GolemRaidKey.png",
        parentName: "/Lotus/Types/Keys/RaidKeys/BaseRaidKey",
        codexSecret: true,
        missionReward: {
            credits: 300000,
            items: ["/Lotus/StoreItems/Upgrades/Mods/FusionBundles/RareFusionBundle"],
            droptable: "/Lotus/Types/Game/MissionDecks/RaidRewards/GolemRaid"
        },
        mission: {
            minEnemyLevel: 92,
            maxEnemyLevel: 97
        }
    },
    "/Lotus/Types/Keys/DerelictGolemKey": {
        name: "/Lotus/Language/Items/OrokinDerelictBossKey",
        description: "/Lotus/Language/Items/OrokinDerelictBossKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        missionReward: {
            credits: 7500,
            droptable: "/Lotus/Types/Game/MissionDecks/GolemMissionRewards"
        },
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 35
        }
    },
    "/Lotus/Types/Keys/DerelictSabotageKey": {
        name: "/Lotus/Language/Items/OrokinDerelictSabotageKey",
        description: "/Lotus/Language/Items/OrokinDerelictSabotageKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        cacheRewardManifest: "/Lotus/Types/Game/MissionDecks/OrokinDerelictSabotageRewards",
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 35
        }
    },
    "/Lotus/Types/Keys/DerelictCaptureKey": {
        name: "/Lotus/Language/Items/OrokinDerelictCaptureKey",
        description: "/Lotus/Language/Items/OrokinDerelictCaptureKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 35
        }
    },
    "/Lotus/Types/Keys/DerelictDefenseKey": {
        name: "/Lotus/Language/Items/OrokinDerelictDefenseKey",
        description: "/Lotus/Language/Items/OrokinDerelictDefenseKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        missionReward: {
            droptable: "/Lotus/Types/Game/MissionDecks/DerelictDefenseRewards"
        },
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 30
        }
    },
    "/Lotus/Types/Keys/DerelictEmissaryBossKey": {
        name: "/Lotus/Language/Items/OrokinDerelictEmissaryBossKey",
        description: "/Lotus/Language/Items/OrokinDerelictBossKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        missionReward: {
            credits: 7500
        },
        mission: {
            minEnemyLevel: 30,
            maxEnemyLevel: 35
        }
    },
    "/Lotus/Types/Keys/DerelictExterminateKey": {
        name: "/Lotus/Language/Items/OrokinDerelictExterminateKey",
        description: "/Lotus/Language/Items/OrokinDerelictExterminateKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 35
        }
    },
    "/Lotus/Types/Keys/DerelictMobileDefenseKey": {
        name: "/Lotus/Language/Items/OrokinDerelictMobDefKey",
        description: "/Lotus/Language/Items/OrokinDerelictMobDefKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 35
        }
    },
    "/Lotus/Types/Keys/DerelictSurvivalKey": {
        name: "/Lotus/Language/Items/OrokinDerelictSurvivalKey",
        description: "/Lotus/Language/Items/OrokinDerelictSurvivalKeyDesc",
        icon: "/Lotus/Interface/Icons/Store/OrokinDerelictKey.png",
        parentName: "/Lotus/Types/Game/KeyItems/DerelictKeyItem",
        codexSecret: false,
        mission: {
            minEnemyLevel: 25,
            maxEnemyLevel: 35
        }
    }
};
