import type { TInventorySlot } from "../types/inventoryTypes/inventoryTypes.ts";

export const u7WeaponCosts: Record<string, number> = {
    "/Lotus/Weapons/Tenno/Pistol/HeavyPistol": 35_000,
    "/Lotus/Weapons/Tenno/Akimbo/AkimboPistol": 12_000,
    "/Lotus/Weapons/Tenno/Pistol/AutoPistol": 15_000,
    "/Lotus/Weapons/Tenno/Pistol/HandShotGun": 35_000,
    "/Lotus/Weapons/Tenno/Pistol/Pistol": 4_000,
    "/Lotus/Weapons/Tenno/Pistol/BurstPistol": 12_000,
    "/Lotus/Weapons/Tenno/Rifle/BurstRifle": 12_000,
    "/Lotus/Weapons/Tenno/Rifle/StartingRifle": 8_000,
    "/Lotus/Weapons/Tenno/Rifle/HeavyRifle": 50_000,
    "/Lotus/Weapons/Tenno/Rifle/SemiAutoRifle": 50_000,
    "/Lotus/Weapons/Tenno/Shotgun/FullAutoShotgun": 50_000,
    "/Lotus/Weapons/Tenno/Rifle/SniperRifle": 50_000,
    "/Lotus/Weapons/Tenno/Rifle/Rifle": 10_000,
    "/Lotus/Weapons/Tenno/Shotgun/Shotgun": 17_500,
    "/Lotus/Weapons/Tenno/Melee/LongSword/LongSword": 15_000,
    "/Lotus/Weapons/Tenno/Melee/Fist/Fist": 30_000,
    "/Lotus/Weapons/Tenno/Melee/DualShortSword/DualShortSword": 45_000,
    "/Lotus/Weapons/Tenno/Melee/Staff/Staff": 15_000
};

export const slotPurchaseData: Record<string, { bin: TInventorySlot; price: number | undefined; amount: number }> = {
    SuitSlotItem: { bin: "SuitBin", price: 20, amount: 1 },
    TwoSentinelSlotItem: { bin: "SentinelBin", price: 12, amount: 2 },
    WeaponSlotItem: { bin: "WeaponBin", price: undefined, amount: 1 },
    TwoWeaponSlotItem: { bin: "WeaponBin", price: 12, amount: 2 },
    SpaceSuitSlotItem: { bin: "SpaceSuitBin", price: 12, amount: 1 },
    TwoSpaceWeaponSlotItem: { bin: "SpaceWeaponBin", price: 12, amount: 2 },
    MechSlotItem: { bin: "MechBin", price: 20, amount: 1 },
    TwoOperatorWeaponSlotItem: { bin: "OperatorAmpBin", price: 12, amount: 2 },
    RandomModSlotItem: { bin: "RandomModBin", price: 60, amount: 3 },
    TwoCrewShipSalvageSlotItem: { bin: "CrewShipSalvageBin", price: 12, amount: 2 },
    CrewMemberSlotItem: { bin: "CrewMemberBin", price: 20, amount: 1 },
    PvPLoadoutSlotItem: { bin: "PvpBonusLoadoutBin", price: undefined, amount: 1 },
    KubrowSlotItem: { bin: "PetBin", price: 10, amount: 1 }
};
