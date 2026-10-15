import type { IDefaultUpgrade, IPowersuit, IUpgrade } from "warframe-public-export-plus";
import {
    ExportArcanes,
    ExportBundles,
    ExportCustoms,
    ExportDojoRecipes,
    ExportDrones,
    ExportGear,
    ExportKeys,
    ExportRailjackWeapons,
    ExportResources,
    ExportSentinels,
    ExportUpgrades,
    ExportWarframes,
    ExportWeapons
} from "warframe-public-export-plus";
import {
    supplementalBundles,
    supplementalItemNames,
    supplementalResources,
    supplementalWeapons
} from "../constants/itemDataSupplemental.ts";
import { supplementalKeys, supplementalSuits, supplementalUpgrades } from "../constants/itemDataSupplementalCatalog.ts";
import { getSyncedWarframe } from "./adminItemDataService.ts";

export const getItemCategoryByUniqueName = (uniqueName: string): string | undefined => {
    if (uniqueName in ExportCustoms) {
        return ExportCustoms[uniqueName].productCategory;
    }
    if (uniqueName in ExportDrones) {
        return "Drones";
    }
    if (uniqueName in ExportKeys) {
        return "LevelKeys";
    }
    if (uniqueName in ExportGear) {
        return "Consumables";
    }
    if (uniqueName in ExportResources || uniqueName in supplementalResources) {
        return (ExportResources[uniqueName] ?? supplementalResources[uniqueName]).productCategory;
    }
    if (uniqueName in ExportSentinels) {
        return ExportSentinels[uniqueName].productCategory;
    }
    if (uniqueName in ExportWarframes) {
        return ExportWarframes[uniqueName].productCategory;
    }
    if (uniqueName in supplementalSuits) {
        return supplementalSuits[uniqueName].productCategory;
    }
    if (uniqueName in ExportWeapons) {
        return ExportWeapons[uniqueName].productCategory;
    }
    if (uniqueName in supplementalWeapons) {
        return supplementalWeapons[uniqueName].productCategory;
    }
    if (uniqueName == "/Lotus/Types/Game/SolarRails/BasicSolarRail") {
        return "SolarRails";
    }
    return undefined;
};

export const getItemName = (uniqueName: string): string | undefined => {
    if (uniqueName in ExportArcanes) {
        return ExportArcanes[uniqueName].name;
    }
    if (uniqueName in ExportBundles) {
        return ExportBundles[uniqueName].name;
    }
    if (uniqueName in supplementalBundles) {
        return supplementalBundles[uniqueName].name;
    }
    if (uniqueName in ExportCustoms) {
        return ExportCustoms[uniqueName].name;
    }
    if (uniqueName in ExportDrones) {
        return ExportDrones[uniqueName].name;
    }
    if (uniqueName in ExportKeys) {
        return ExportKeys[uniqueName].name;
    }
    if (uniqueName in supplementalKeys) {
        return supplementalKeys[uniqueName].name;
    }
    if (uniqueName in ExportGear) {
        return ExportGear[uniqueName].name;
    }
    if (uniqueName in ExportResources || uniqueName in supplementalResources) {
        return (ExportResources[uniqueName] ?? supplementalResources[uniqueName]).name;
    }
    if (uniqueName in ExportSentinels) {
        return ExportSentinels[uniqueName].name;
    }
    if (uniqueName in ExportWarframes) {
        return ExportWarframes[uniqueName].name;
    }
    if (uniqueName in supplementalSuits) {
        return supplementalSuits[uniqueName].name;
    }
    if (uniqueName in ExportWeapons) {
        return ExportWeapons[uniqueName].name;
    }
    if (uniqueName in supplementalWeapons) {
        return supplementalWeapons[uniqueName].name;
    }
    if (uniqueName in ExportRailjackWeapons) {
        return ExportRailjackWeapons[uniqueName].name;
    }
    if (uniqueName in ExportDojoRecipes.colours) {
        return ExportDojoRecipes.colours[uniqueName].name;
    }
    if (uniqueName in ExportDojoRecipes.backdrops) {
        return ExportDojoRecipes.backdrops[uniqueName].name;
    }
    if (uniqueName in ExportDojoRecipes.decos) {
        return ExportDojoRecipes.decos[uniqueName].name;
    }
    if (uniqueName in supplementalItemNames) {
        return supplementalItemNames[uniqueName];
    }
    return undefined;
};

export const getDefaultUpgrades = (parts: string[]): IDefaultUpgrade[] | undefined => {
    const allDefaultUpgrades: IDefaultUpgrade[] = [];
    for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const defaultUpgrades = ExportWeapons[part]?.defaultUpgrades;
        if (defaultUpgrades) {
            allDefaultUpgrades.push(...defaultUpgrades);
        }
    }
    return allDefaultUpgrades.length == 0 ? undefined : allDefaultUpgrades;
};

export const getMaxLevelCap = (type: string): number => {
    if (type in ExportWarframes) {
        return ExportWarframes[type].maxLevelCap ?? 30;
    }
    if (type in ExportWeapons) {
        return ExportWeapons[type].maxLevelCap ?? 30;
    }
    return 30;
};

export const getProductCategory = (uniqueName: string): string => {
    if (uniqueName in ExportCustoms) {
        return ExportCustoms[uniqueName].productCategory;
    }
    if (uniqueName in ExportGear) {
        return "Consumables";
    }
    if (uniqueName in ExportResources || uniqueName in supplementalResources) {
        return (ExportResources[uniqueName] ?? supplementalResources[uniqueName]).productCategory;
    }
    if (uniqueName in ExportWeapons) {
        return ExportWeapons[uniqueName].productCategory;
    }
    if (uniqueName in supplementalWeapons) {
        return supplementalWeapons[uniqueName].productCategory;
    }
    throw new Error(`don't know product category of ${uniqueName}`);
};

export const getPowerSuit = (uniqueName: string): IPowersuit | undefined => {
    return (
        getSyncedWarframe(uniqueName) ??
        (uniqueName in ExportWarframes ? ExportWarframes[uniqueName] : supplementalSuits[uniqueName])
    );
};

// For prex cards
export const getShipDecoByNameTag = (name: string): string => {
    for (const [uniqueName, data] of Object.entries(ExportResources)) {
        if (data.productCategory == "ShipDecorations" && data.name == name) {
            return uniqueName;
        }
    }
    throw new Error(`No ship deco with name tag ${name}`);
};

export const getUpgrade = (uniqueName: string): IUpgrade | undefined => {
    return ExportUpgrades[uniqueName] ?? supplementalUpgrades[uniqueName];
};
