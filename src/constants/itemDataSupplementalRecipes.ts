import type { IRecipe } from "warframe-public-export-plus";

export const supplementalRecipes: Record<string, IRecipe> = {
    // Removed in 39.0.0
    "/Lotus/Types/Recipes/EidolonRecipes/OpenArchwingSummonBlueprint": {
        resultType: "/Lotus/Types/Restoratives/OpenArchwingSummon",
        buildPrice: 7500,
        buildTime: 1800,
        skipBuildTimePrice: 10,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        alwaysAvailable: true,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/IraditeItem",
                ItemCount: 50
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/GrokdrulItem",
                ItemCount: 50
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishOilItem",
                ItemCount: 30
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                ItemCount: 600
            }
        ],
        excludeFromMarket: true,
        tradable: false
    },
    // The Law of Retribution raid bp. Removed in 22.14.0
    "/Lotus/Types/Keys/GrineerRaidKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/RaidKeys/Raid01Stage01KeyItem",
        buildPrice: 5000,
        buildTime: 21600,
        skipBuildTimePrice: 15,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                ItemCount: 500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 9000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Gallium",
                ItemCount: 1
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 100000
    },
    // The Law of Retribution (Nightmare) raid bp. Removed in 22.14.0
    "/Lotus/Types/Keys/NightmareGrineerRaidKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/RaidKeys/Raid01Stage01NightmareKeyItem",
        buildPrice: 5000,
        buildTime: 21600,
        skipBuildTimePrice: 15,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                ItemCount: 1000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 18000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Gallium",
                ItemCount: 2
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 100000
    },
    // The Jordas Verdict raid bp. Removed in 22.14.0
    "/Lotus/Types/Keys/GolemRaidKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/RaidKeys/RaidGolemStage01KeyItem",
        buildPrice: 5000,
        buildTime: 21600,
        skipBuildTimePrice: 15,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                ItemCount: 2000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 12000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Neurode",
                ItemCount: 2
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 100000
    },
    // Orokin Derelict Assassination bp for Lephantis. Removed in 28.3.0
    "/Lotus/Types/Keys/GolemKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictGolemKey",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/BossNavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 4000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                ItemCount: 1000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                ItemCount: 100
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 2500
    },
    // Orokin Derelict Capture bp. Removed in 28.3.0
    "/Lotus/Types/Keys/DerelictCaptureKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictCaptureKey",
        buildPrice: 6500,
        buildTime: 60,
        skipBuildTimePrice: 5,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/NavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 2500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                ItemCount: 750
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                ItemCount: 80
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 1500
    },
    // Orokin Derelict Defense bp. Removed in 28.3.0
    "/Lotus/Types/Keys/DerelictDefenseKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictDefenseKey",
        buildPrice: 6500,
        buildTime: 60,
        skipBuildTimePrice: 5,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/NavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 2500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                ItemCount: 750
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle",
                ItemCount: 80
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 1500
    },
    // Orokin Derelict Exterminate bp. Removed in 28.3.0
    "/Lotus/Types/Keys/DerelictExterminateKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictExterminateKey",
        buildPrice: 6500,
        buildTime: 60,
        skipBuildTimePrice: 5,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/NavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 2500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                ItemCount: 750
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                ItemCount: 80
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 1500
    },
    // Orokin Derelict Mobile Defense bp. Removed in 28.3.0
    "/Lotus/Types/Keys/DerelictMobileDefenseKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictMobileDefenseKey",
        buildPrice: 6500,
        buildTime: 60,
        skipBuildTimePrice: 5,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/NavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 2500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                ItemCount: 750
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle",
                ItemCount: 80
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 1500
    },
    // Orokin Derelict Sabotage bp. Removed in 28.3.0
    "/Lotus/Types/Keys/DerelictSabotageKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictSabotageKey",
        buildPrice: 6500,
        buildTime: 60,
        skipBuildTimePrice: 5,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/NavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 2500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                ItemCount: 750
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle",
                ItemCount: 80
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 1500
    },
    // Orokin Derelict Survival bp. Removed in 28.3.0
    "/Lotus/Types/Keys/DerelictSurvivalKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/DerelictSurvivalKey",
        buildPrice: 6500,
        buildTime: 60,
        skipBuildTimePrice: 5,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/NavCode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                ItemCount: 2500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                ItemCount: 750
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                ItemCount: 80
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 1500
    },
    // Vay Hek Frequency Triangulator (Assassination key) bp. Removed in 15.13.0
    "/Lotus/Types/Keys/VeyHekKeyBlueprint": {
        resultType: "/Lotus/Types/Keys/VeyHekKey",
        buildPrice: 20000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentA",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentB",
                ItemCount: 4
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentC",
                ItemCount: 8
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentD",
                ItemCount: 12
            }
        ],
        excludeFromMarket: true,
        tradable: false,
        creditsCost: 10000
    },
    "/Lotus/Types/Recipes/KevinTestRecipe": {
        resultType: "/Lotus/Upgrades/Modules/Crafted/IncendiaryRifleMod",
        buildPrice: 1000,
        buildTime: 180,
        skipBuildTimePrice: 10,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Actuator",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Weapons/Tenno/Pistol/LotusPistol",
                ItemCount: 1
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/IncendiaryRifleModBlueprint": {
        resultType: "/Lotus/Upgrades/Modules/Crafted/IncendiaryRifleMod",
        buildPrice: 6000,
        buildTime: 43200,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Upgrades/Modules/GrineerRifleModule",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                ItemCount: 500
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                ItemCount: 50
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Game/SolarRails/BasicSolarRailBlueprint": {
        resultType: "/Lotus/Types/Game/SolarRails/BasicSolarRail",
        buildPrice: 500000,
        buildTime: 86400,
        skipBuildTimePrice: 0,
        consumeOnUse: false,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Gallium",
                ItemCount: 25
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                ItemCount: 15000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                ItemCount: 15000
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/ControlModule",
                ItemCount: 25
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/ArmourOnOperatorModeBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/ArmourOnOperatorMode",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishScalesItem",
                ItemCount: 40
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/BothRareFishAPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/AttackSpeedOnKillBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/AttackSpeedOnKill",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishScalesItem",
                ItemCount: 40
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/BothRareFishAPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/CriticalChanceOnHeadshotBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/CriticalChanceOnHeadshot",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 40
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightLegendaryFishAPartItem",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/HealOnTransferenceInBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HealOnTransferenceIn",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightLegendaryFishAPartItem",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/HealOnTransferenceOutBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HealOnTransferenceOut",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightLegendaryFishAPartItem",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/HealOnVoidDashBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HealOnVoidDash",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightLegendaryFishAPartItem",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/HealthOnOperatorModeBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HealthOnOperatorMode",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishScalesItem",
                ItemCount: 40
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/BothRareFishAPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/ImmunityFallDamageOnVoidDashBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/ImmunityFallDamageOnVoidDash",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightRareFishBPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/IncreasedCriticalDamageOnCriticalStrikeBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/IncreasedCriticalDamageOnCriticalStrike",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightRareFishAPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/IncreasedDamageOnStatusProcBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/IncreasedDamageOnStatusProc",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightRareFishBPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/OperatorAmmoRegenOnKillBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/OperatorAmmoRegenOnKill",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishScalesItem",
                ItemCount: 40
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/BothRareFishAPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/SpeedOnVoidDashBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/SpeedOnVoidDash",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightRareFishAPartItem",
                ItemCount: 2
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Quills/StatusChanceOnHeadshotBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/StatusChanceOnHeadshot",
        buildPrice: 15000,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/NightLegendaryFishAPartItem",
                ItemCount: 1
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 10
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/ChannelKillEnergyRateBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/ChannelKillEnergyRate",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 20
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/ForestRodentPartItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/CritChannelingDamageBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/CritChannelingDamage",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 20
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/BirdOfPreyPartItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/FinisherLifestealBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/FinisherLifesteal",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 20
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/DayUncommonFishAPartItem",
                ItemCount: 40
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/GroundSlamPullBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/GroundSlamPull",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 20
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/BothUncommonFishAPartItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/MeleeArcaneProjectileOnJumpBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/MeleeArcaneProjectileOnJump",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Neurode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                ItemCount: 800
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/MeleeArcaneShockwaveOnJumpBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/MeleeArcaneShockwaveOnJump",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Neurode",
                ItemCount: 5
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                ItemCount: 800
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/StatusChannelingDamageBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/StatusChannelingDamage",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 20
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/DayUncommonFishBPartItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/EidolonRecipes/Arcanes/Weaponsmith/StatusTriggerRadialDamageBlueprint": {
        resultType: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/StatusTriggerRadialDamage",
        buildPrice: 7500,
        buildTime: 3600,
        skipBuildTimePrice: 10,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            {
                ItemType: "/Lotus/Types/Items/MiscItems/Eidolonium",
                ItemCount: 20
            },
            {
                ItemType: "/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Fish/Eidolon/FishParts/BothUncommonFishBPartItem",
                ItemCount: 10
            },
            {
                ItemType: "/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem",
                ItemCount: 3
            }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/WarframeRecipes/NarinBlueprint": {
        resultType: "/Lotus/Powersuits/Duelist/Duelist",
        buildPrice: 25000,
        buildTime: 259200,
        skipBuildTimePrice: 50,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Recipes/WarframeRecipes/NarinHelmetComponent", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Recipes/WarframeRecipes/NarinChassisComponent", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Recipes/WarframeRecipes/NarinSystemsComponent", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Items/MiscItems/OrokinCell", ItemCount: 1 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/WarframeRecipes/NarinChassisBlueprint": {
        resultType: "/Lotus/Types/Recipes/WarframeRecipes/NarinChassisComponent",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate", ItemCount: 3300 },
            { ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle", ItemCount: 1200 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Cryotic", ItemCount: 800 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Morphic", ItemCount: 10 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/WarframeRecipes/NarinHelmetBlueprint": {
        resultType: "/Lotus/Types/Recipes/WarframeRecipes/NarinHelmetComponent",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/Plastids", ItemCount: 2900 },
            { ItemType: "/Lotus/Types/Items/MiscItems/NeuralSensor", ItemCount: 4 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemB", ItemCount: 6 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/VoidWraithItem", ItemCount: 400 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/WarframeRecipes/NarinSystemsBlueprint": {
        resultType: "/Lotus/Types/Recipes/WarframeRecipes/NarinSystemsComponent",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemA", ItemCount: 55 },
            { ItemType: "/Lotus/Types/Items/MiscItems/ArgonCrystal", ItemCount: 2 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Circuits", ItemCount: 2100 },
            { ItemType: "/Lotus/Types/Items/MiscItems/ControlModule", ItemCount: 10 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/DuelistBowBlueprint": {
        resultType: "/Lotus/Weapons/Tenno/Bows/DuelistBow/DuelistBow",
        buildPrice: 20000,
        buildTime: 86400,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        excludeFromCodex: true,
        ingredients: [
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimb", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowString", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowGrip", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimb", ItemCount: 1 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimbBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimb",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate", ItemCount: 1700 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemA", ItemCount: 30 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/VoidAngelItem", ItemCount: 2 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Plastids", ItemCount: 800 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimbBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimb",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate", ItemCount: 1700 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemA", ItemCount: 30 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/VoidAngelItem", ItemCount: 2 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Plastids", ItemCount: 800 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowStringBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowString",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle", ItemCount: 750 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Gallium", ItemCount: 4 },
            { ItemType: "/Lotus/Types/Items/MiscItems/OxiumAlloy", ItemCount: 100 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Neurode", ItemCount: 2 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowGripBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowGrip",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/Cryotic", ItemCount: 400 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Salvage", ItemCount: 2500 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemB", ItemCount: 2 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Morphic", ItemCount: 5 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/DuelistPistolsBlueprint": {
        resultType: "/Lotus/Weapons/Tenno/Pistols/DuelistPistols/DuelistPistols",
        buildPrice: 15000,
        buildTime: 43200,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        excludeFromCodex: true,
        ingredients: [
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrel", ItemCount: 2 },
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiver", ItemCount: 2 },
            { ItemType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLink", ItemCount: 1 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrelBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrel",
        buildPrice: 10000,
        buildTime: 21600,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle", ItemCount: 650 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemB", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate", ItemCount: 1200 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Cryotic", ItemCount: 100 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiverBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiver",
        buildPrice: 10000,
        buildTime: 21600,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Items/MiscItems/Rubedo", ItemCount: 400 },
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemA", ItemCount: 40 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Neurode", ItemCount: 1 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Salvage", ItemCount: 900 }
        ],
        tradable: false
    },
    "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLinkBlueprint": {
        resultType: "/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLink",
        buildPrice: 10000,
        buildTime: 21600,
        skipBuildTimePrice: 25,
        consumeOnUse: true,
        num: 1,
        codexSecret: false,
        ingredients: [
            { ItemType: "/Lotus/Types/Gameplay/Zariman/Resources/VoidWraithItem", ItemCount: 50 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Nanospores", ItemCount: 8200 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Circuits", ItemCount: 600 },
            { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 2600 }
        ],
        tradable: false
    }
};
