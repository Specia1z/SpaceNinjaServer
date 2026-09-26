import type { TInventoryDatabaseDocument } from "../models/inventoryModels/inventoryModel.ts";
import type { IInventoryChanges } from "../types/purchaseTypes.ts";
import type { TEquipmentKey, IWeaponSkinClient, IUpgradeClient } from "../types/inventoryTypes/inventoryTypes.ts";
import type { IEquipmentClient, IEquipmentDatabase } from "../types/equipmentTypes.ts";
import { logger } from "../utils/logger.ts";

export const addEquipment = <K extends TEquipmentKey>(
    inventory: Pick<TInventoryDatabaseDocument, K>,
    category: K,
    type: string,
    defaultOverwrites?: Partial<IEquipmentDatabase>,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    const equipment: Omit<IEquipmentDatabase, "_id"> = Object.assign(
        {
            ItemType: type,
            Configs: [],
            XP: 0,
            IsNew: category != "CrewShipWeapons" && category != "CrewShipSalvagedWeapons"
        },
        defaultOverwrites
    );
    if (equipment.IsNew) equipment.IsNew = !inventory[category].find(x => x.ItemType == type);
    if (!equipment.IsNew) equipment.IsNew = undefined;
    const index = inventory[category].push(equipment) - 1;
    inventoryChanges[category] ??= [];
    inventoryChanges[category].push(inventory[category][index].toJSON<IEquipmentClient>());
    return inventoryChanges;
};

export const addSkin = (
    inventory: Pick<TInventoryDatabaseDocument, "WeaponSkins" | "BountyScore">,
    typeName: string,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    if (typeName == "/Lotus/Upgrades/Skins/Clan/BountyHunterBadgeItem") {
        logger.debug(`stratos emblem, increasing bounty score`);
        inventory.BountyScore ??= 0;
        inventory.BountyScore += 1;
    }
    if (typeName.endsWith("LeftArmor")) {
        addSkin(
            inventory,
            typeName.substring(0, typeName.length - "LeftArmor".length) + "RightArmor",
            inventoryChanges
        );
    }
    if (inventory.WeaponSkins.some(x => x.ItemType == typeName)) {
        logger.debug(`refusing to add WeaponSkin ${typeName} because account already owns it`);
    } else {
        const index =
            inventory.WeaponSkins.push({
                ItemType: typeName,
                IsNew: typeName.startsWith("/Lotus/Upgrades/Skins/RailJack/") ? undefined : true
            }) - 1;
        inventoryChanges.WeaponSkins ??= [];
        inventoryChanges.WeaponSkins.push(inventory.WeaponSkins[index].toJSON<IWeaponSkinClient>());
    }
    return inventoryChanges;
};

export const addCrewShipWeaponSkin = (
    inventory: Pick<TInventoryDatabaseDocument, "CrewShipWeaponSkins">,
    typeName: string,
    upgradeFingerprint: string | undefined,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    const index =
        inventory.CrewShipWeaponSkins.push({ ItemType: typeName, UpgradeFingerprint: upgradeFingerprint }) - 1;
    inventoryChanges.CrewShipWeaponSkins ??= [];
    inventoryChanges.CrewShipWeaponSkins.push(inventory.CrewShipWeaponSkins[index].toJSON<IUpgradeClient>());
    return inventoryChanges;
};

export const addCrewShipSalvagedWeaponSkin = (
    inventory: TInventoryDatabaseDocument,
    typeName: string,
    upgradeFingerprint: string | undefined,
    inventoryChanges: IInventoryChanges = {}
): IInventoryChanges => {
    const index =
        inventory.CrewShipSalvagedWeaponSkins.push({ ItemType: typeName, UpgradeFingerprint: upgradeFingerprint }) - 1;
    inventoryChanges.CrewShipSalvagedWeaponSkins ??= [];
    inventoryChanges.CrewShipSalvagedWeaponSkins.push(
        inventory.CrewShipSalvagedWeaponSkins[index].toJSON<IUpgradeClient>()
    );
    return inventoryChanges;
};
