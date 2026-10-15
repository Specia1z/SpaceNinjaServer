import type { IRecipe } from "warframe-public-export-plus";
import { ExportRecipes } from "warframe-public-export-plus";
import gameToBuildVersion from "../constants/gameToBuildVersion.ts";
import { supplementalRecipes } from "../constants/itemDataSupplementalRecipes.ts";
import { version_compare } from "../helpers/inventoryHelpers.ts";
import type { Mutable } from "../utils/ts-utils.ts";
import { getCraftingOverride } from "./craftingConfigService.ts";

export const getRecipe = (uniqueName: string, buildLabel: string): IRecipe | undefined => {
    let data = ExportRecipes[uniqueName] ?? supplementalRecipes[uniqueName];
    if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/RhinoBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["39.0.0"]) < 0) {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Gallium",
                        ItemCount: 1
                    }
                ]
            };
            if (version_compare(buildLabel, gameToBuildVersion["38.5.0"]) < 0) {
                data.buildTime = 259200;
                // Update 19.13 (2017-03-09)
                if (version_compare(buildLabel, "2017.03.09.00.00") < 0) {
                    data.ingredients[3].ItemType = "/Lotus/Types/Items/MiscItems/OrokinCell";
                }
            }
        }
    } else if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/RhinoChassisBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["39.0.0"]) < 0) {
            data = {
                ...data,
                ingredients: [
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Morphic",
                        ItemCount: 1
                    },
                    data.ingredients[1],
                    data.ingredients[2]
                ]
            };
        }
    } else if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/RhinoHelmetBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["39.0.0"]) < 0) {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Morphic",
                        ItemCount: 1
                    },
                    data.ingredients[2],
                    data.ingredients[3]
                ]
            };
            // Update 19.13 (2017-03-09)
            if (version_compare(buildLabel, "2017.03.09.00.00") < 0) {
                data.ingredients[1].ItemType = "/Lotus/Types/Items/MiscItems/NeuralSensor";
            }
        }
    } else if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/RhinoSystemsBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["39.0.0"]) < 0) {
            data = {
                ...data,
                ingredients: [
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Gallium",
                        ItemCount: 1
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Morphic",
                        ItemCount: 1
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                        ItemCount: 500
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                        ItemCount: 600
                    }
                ]
            };
            // Hotfix 30.0.6 (2021-04-20) Swapped the crafting requirement of Control Module for Gallium in Rhino Systems Blueprint to ease early player acquisition.
            if (version_compare(buildLabel, "2021.04.20.00.00") < 0) {
                data.ingredients[0].ItemType = "/Lotus/Types/Items/MiscItems/ControlModule";
            }
        }
    } else if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/ExcaliburBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["42.0.0"]) < 0) {
            data = {
                ...data,
                buildTime: 259200
            };
        }
    } else if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/MagBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["42.0.0"]) < 0) {
            data = {
                ...data,
                buildTime: 259200
            };
        }
    } else if (uniqueName == "/Lotus/Types/Recipes/WarframeRecipes/VOLTBlueprint") {
        if (version_compare(buildLabel, gameToBuildVersion["42.0.0"]) < 0) {
            data = {
                ...data,
                buildTime: 259200
            };
        }
    }

    if (version_compare(buildLabel, gameToBuildVersion["9.1.2"]) < 0) {
        // There was an undocumented change to this recipe's ingredients sometime between 8.3.0 and 9.1.2...
        if (uniqueName == "/Lotus/Types/Recipes/Weapons/HuntingBowBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                        ItemCount: 300
                    },
                    {
                        ...data.ingredients[2],
                        ItemCount: 500
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 1250
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/DualAxeBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                        ItemCount: 600
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                        ItemCount: 80
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/QuadShotgunBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                        ItemCount: 500
                    },
                    {
                        ...data.ingredients[2],
                        ItemCount: 900
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle",
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/DarkDaggerBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    data.ingredients[1],
                    {
                        ...data.ingredients[2],
                        ItemCount: 150
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 75
                    }
                ]
            };
        } else if (
            [
                "/Lotus/Types/Recipes/SentinelRecipes/DethCubeSentinelBlueprint",
                "/Lotus/Types/Recipes/SentinelRecipes/ShadeSentinelBlueprint",
                "/Lotus/Types/Recipes/SentinelRecipes/WyrmSentinelBlueprint"
            ].includes(uniqueName)
        ) {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 100
                    },
                    data.ingredients[1],
                    data.ingredients[2],
                    data.ingredients[3]
                ]
            };
        } else if (
            [
                "/Lotus/Types/Recipes/WarframeRecipes/AshSystemsBlueprint",
                "/Lotus/Types/Recipes/WarframeRecipes/FrostSystemsBlueprint",
                "/Lotus/Types/Recipes/WarframeRecipes/RhinoSystemsBlueprint"
            ].includes(uniqueName)
        ) {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 220
                    }
                ]
            };
        } else if (
            [
                "/Lotus/Types/Recipes/Weapons/Skins/DaggerAxeBlueprint",
                "/Lotus/Types/Recipes/Weapons/Skins/DualDaggerAxeBlueprint"
            ].includes(uniqueName)
        ) {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemType: "/Lotus/Types/Items/MiscItems/Rubedo"
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/StrunShotgunBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 550
                    },
                    data.ingredients[2],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle",
                        ItemCount: 50
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/StalkerBowBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 5
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 600
                    },
                    data.ingredients[2],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                        ItemCount: 1500
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/SnipetronBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                        ItemCount: 300
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 300
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/SkanaSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    data.ingredients[1],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                        ItemCount: 700
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 80
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/PolearmBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                        ItemCount: 900
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/PangolinSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    {
                        ...data.ingredients[2],
                        ItemType: "/Lotus/Types/Items/MiscItems/Rubedo"
                    },
                    data.ingredients[3]
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/MireSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 500
                    },
                    {
                        ...data.ingredients[2],
                        ItemCount: 300
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 75
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/MacheteBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    data.ingredients[1],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                        ItemCount: 700
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 150
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/LatronBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                        ItemCount: 350
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 250
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/KogakeBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                        ItemCount: 900
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 2
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 120
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/HeatSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 75
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/GrnStaffBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    data.ingredients[1],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                        ItemCount: 250
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/GrnSniperRifleBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 300
                    },
                    data.ingredients[2],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                        ItemCount: 300
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/GorgonBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemType: "/Lotus/Types/Items/MiscItems/Rubedo"
                    }
                ]
            };
        } else if (
            ["/Lotus/Types/Recipes/Weapons/GauntletBlueprint", "/Lotus/Types/Recipes/Weapons/FuraxBlueprint"].includes(
                uniqueName
            )
        ) {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 700
                    },
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 150
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/FurisBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 2
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/EtherSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 750
                    },
                    {
                        ...data.ingredients[2],
                        ItemCount: 600
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/DualSkanaSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                        ItemCount: 900
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 80
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/DualHeatSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    {
                        ...data.ingredients[2],
                        ItemCount: 850
                    },
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                        ItemCount: 80
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/DualEtherSwordBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                        ItemCount: 80
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/DualCleaversBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 3
                    },
                    data.ingredients[1],
                    {
                        ...data.ingredients[2],
                        ItemType: "/Lotus/Types/Items/MiscItems/Ferrite"
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 250
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/CeramicDaggerBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 2
                    },
                    data.ingredients[1],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                        ItemCount: 300
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 75
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/BurstonRifleBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/BroncoBlueprint") {
            data = {
                ...data,
                ingredients: [
                    {
                        ...data.ingredients[0],
                        ItemCount: 1
                    },
                    {
                        ...data.ingredients[1],
                        ItemCount: 100
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/BoltorBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    {
                        ...data.ingredients[1],
                        ItemCount: 500
                    },
                    data.ingredients[2],
                    {
                        ...data.ingredients[3],
                        ItemCount: 100
                    }
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/BoltoBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    {
                        ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                        ItemCount: 300
                    },
                    {
                        ...data.ingredients[2],
                        ItemCount: 1
                    },
                    data.ingredients[3]
                ]
            };
        } else if (uniqueName == "/Lotus/Types/Recipes/Weapons/AxeBlueprint") {
            data = {
                ...data,
                ingredients: [
                    data.ingredients[0],
                    data.ingredients[1],
                    {
                        ...data.ingredients[2],
                        ItemType: "/Lotus/Types/Items/MiscItems/Rubedo"
                    },
                    {
                        ...data.ingredients[3],
                        ItemCount: 80
                    }
                ]
            };
        }
    }

    if (uniqueName.startsWith("/Lotus/StoreItems/Types/Recipes/EidolonRecipes/Arcanes/")) {
        if (version_compare(buildLabel, gameToBuildVersion["22.2.4"]) >= 0) {
            const wdata = structuredClone(data) as Mutable<IRecipe>;
            if (uniqueName.endsWith("ArmourOnOperatorModeBlueprint")) {
                wdata.ingredients[0].ItemCount = 20;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Cryotic",
                    ItemCount: 7100
                };
            } else if (uniqueName.endsWith("AttackSpeedOnKillBlueprint")) {
                wdata.ingredients[0].ItemCount = 20;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                    ItemCount: 3500
                };
            } else if (uniqueName.endsWith("CriticalChanceOnHeadshotBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                    ItemCount: 5200
                };
            } else if (uniqueName.endsWith("HealOnTransferenceInBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[1].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/OxiumAlloy",
                    ItemCount: 2300
                };
            } else if (uniqueName.endsWith("HealOnTransferenceOutBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[1].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/PolymerBundle",
                    ItemCount: 8700
                };
            } else if (uniqueName.endsWith("HealOnVoidDashBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[1].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Salvage",
                    ItemCount: 9200
                };
            } else if (uniqueName.endsWith("HealthOnOperatorModeBlueprint")) {
                wdata.ingredients[0].ItemCount = 20;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/AlloyPlate",
                    ItemCount: 6400
                };
            } else if (uniqueName.endsWith("ImmunityFallDamageOnVoidDashBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Ferrite",
                    ItemCount: 7600
                };
            } else if (uniqueName.endsWith("IncreasedCriticalDamageOnCriticalStrikeBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                    ItemCount: 4400
                };
            } else if (uniqueName.endsWith("IncreasedDamageOnStatusProcBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Rubedo",
                    ItemCount: 4100
                };
            } else if (uniqueName.endsWith("OperatorAmmoRegenOnKillBlueprint")) {
                wdata.ingredients[0].ItemCount = 20;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Circuits",
                    ItemCount: 3200
                };
            } else if (uniqueName.endsWith("SpeedOnVoidDashBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[1].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Nanospores",
                    ItemCount: 8100
                };
            } else if (uniqueName.endsWith("StatusChanceOnHeadshotBlueprint")) {
                wdata.ingredients[0].ItemCount = 3;
                wdata.ingredients[3] = {
                    ItemType: "/Lotus/Types/Items/MiscItems/Plastids",
                    ItemCount: 4800
                };
            } else if (
                uniqueName.endsWith("ChannelKillEnergyRateBlueprint") ||
                uniqueName.endsWith("CritChannelingDamageBlueprint")
            ) {
                wdata.ingredients[0].ItemCount = 10;
            } else if (
                uniqueName.endsWith("FinisherLifestealBlueprint") ||
                uniqueName.endsWith("GroundSlamPullBlueprint") ||
                uniqueName.endsWith("StatusChannelingDamageBlueprint") ||
                uniqueName.endsWith("StatusTriggerRadialDamageBlueprint")
            ) {
                wdata.ingredients[0].ItemCount = 10;
                wdata.ingredients[2].ItemCount = 5;
            }
            data = wdata;
        }
        if (version_compare(buildLabel, "2017.12.08.15.29") >= 0) {
            // Should be 22.3.4 - 2017-11-16
            if (
                uniqueName.endsWith("ArmourOnOperatorModeBlueprint") ||
                uniqueName.endsWith("HealOnTransferenceInBlueprint")
            ) {
                data.ingredients[3].ItemCount = data.ingredients[3].ItemCount / 10;
            }
        }
    }
    return applyCraftingOverride(uniqueName, data);
};

// Applies the server operator's crafting policy. Returns `data` untouched when no policy is configured, so the
// stock behaviour is preserved exactly.
const applyCraftingOverride = (recipeTypeName: string, data: IRecipe | undefined): IRecipe | undefined => {
    if (!data) return data;
    const override = getCraftingOverride(recipeTypeName);
    const changes: Partial<IRecipe> = {};
    if (override.buildTime !== undefined) {
        changes.buildTime = override.buildTime;
    }
    if (override.buildPriceMultiplier !== 1) {
        changes.buildPrice = Math.round(data.buildPrice * override.buildPriceMultiplier);
    }
    if (override.skipBuildTimePrice !== undefined) {
        changes.skipBuildTimePrice = override.skipBuildTimePrice;
    }
    if (override.consumeOnUse !== undefined) {
        changes.consumeOnUse = override.consumeOnUse;
    }
    return Object.keys(changes).length ? { ...data, ...changes } : data;
};
