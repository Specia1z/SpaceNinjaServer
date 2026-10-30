import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { JSONStringify } from "json-with-bigint";
import { getInfestedLichItemRewards, getKillTokenRewardCount } from "../../helpers/nemesisHelpers.ts";
import { Inventory } from "../../models/inventoryModels/inventoryModel.ts";
import { Account } from "../../models/loginModel.ts";
import { MissionSettlementClaim } from "../../models/missionSettlementClaimModel.ts";
import { fromStoreItem } from "../../services/itemDataService.ts";
import type { IMissionInventoryUpdateResponse } from "../../types/missionTypes.ts";
import type { IMissionInventoryUpdateRequest } from "../../types/requestTypes.ts";
import { getMissionSettlementKey } from "../../services/missionSettlementClaimService.ts";
import { missionInventoryUpdateController } from "./missionInventoryUpdateController.ts";

let mongod: MongoMemoryServer;

before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: "7.0.34", downloadDir: "node_modules/.cache" } });
    await mongoose.connect(`${mongod.getUri()}mission-inventory-update-controller-test`);
    await MissionSettlementClaim.init();
});

after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

void test("a completed settlement replay does not apply client inventory deltas", async () => {
    const account = await new Account({
        email: "settlement-replay@example.com",
        password: "password",
        DisplayName: "SettlementReplay",
        Nonce: 654,
        BuildLabel: "2013.01.04.10.41/"
    }).save();
    const inventory = await new Inventory({ accountOwnerId: account._id, RegularCredits: 100 }).save();
    const report = {
        LevelKeyName: "",
        MissionFailed: true,
        MissionStatus: "GS_FAILURE",
        AliveTime: 0,
        MissionTime: 0,
        GameModeId: 0,
        hosts: [],
        currentClients: [],
        ChallengeProgress: [],
        PS: "",
        ActiveDojoColorResearch: "",
        ReceivedCeremonyMsg: false,
        LastCeremonyResetDate: 0,
        MissionPTS: 42,
        RepHash: "rep-hash-1",
        EndOfMatchUpload: true,
        ObjectiveReached: false,
        sharedSessionId: "0123456789abcdef01234567",
        FpsAvg: 0,
        FpsMin: 0,
        FpsMax: 0,
        FpsSamples: 0,
        PlayerSkillGains: {},
        RegularCredits: 25
    } as IMissionInventoryUpdateRequest;
    const settlementKey = getMissionSettlementKey(report);
    assert.ok(settlementKey);
    await MissionSettlementClaim.create({
        accountId: account._id,
        settlementKey,
        status: "completed",
        claimToken: "previous-claim",
        claimedAt: new Date(),
        completedAt: new Date()
    });

    let responseBody: unknown;
    const response = {
        json(value: unknown) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654" },
        body: JSON.stringify(report),
        ip: "127.0.0.1"
    } as unknown as Request;

    await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});

    assert.deepEqual(responseBody, {});
    assert.equal((await Inventory.findById(inventory._id))?.RegularCredits, 100);
});

void test("solo end-of-match settlement saves equipment XP without a shared session ID", async () => {
    const account = await new Account({
        email: "solo-xp-settlement@example.com",
        password: "password",
        DisplayName: "SoloXpSettlement",
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/"
    }).save();
    const inventory = await new Inventory({
        accountOwnerId: account._id,
        LongGuns: [{ ItemType: "/Lotus/Weapons/Tenno/LongGuns/Soma/Soma", XP: 0 }]
    }).save();
    const weaponId = inventory.LongGuns[0]._id.toString();
    const report = {
        LevelKeyName: "",
        MissionFailed: false,
        MissionStatus: "GS_SUCCESS",
        AliveTime: 60,
        MissionTime: 60,
        GameModeId: 0,
        hosts: [],
        currentClients: [],
        ChallengeProgress: [],
        PS: "",
        ActiveDojoColorResearch: "",
        ReceivedCeremonyMsg: false,
        LastCeremonyResetDate: 0,
        MissionPTS: 1234567890,
        RepHash: "solo-xp-report-1",
        EndOfMatchUpload: true,
        ObjectiveReached: true,
        FpsAvg: 0,
        FpsMin: 0,
        FpsMax: 0,
        FpsSamples: 0,
        PlayerSkillGains: {},
        Missions: { Tag: "SolNode1", Completes: 1, Tier: 0 },
        RewardInfo: { node: "SolNode1", rewardSeed: 123 },
        LongGuns: [{ ItemId: { $oid: weaponId }, XP: 1200 }]
    } as unknown as IMissionInventoryUpdateRequest;

    let responseBody: IMissionInventoryUpdateResponse | undefined;
    const response = {
        json(value: typeof responseBody) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654", xpBasedLevelCapDisabled: "1" },
        body: JSON.stringify(report),
        ip: "127.0.0.1"
    } as unknown as Request;

    const originalStringify = JSON.stringify;
    try {
        JSON.stringify = JSONStringify;
        await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
    } finally {
        JSON.stringify = originalStringify;
    }

    const savedInventory = (await Inventory.findById(inventory._id))!;
    assert.equal(savedInventory.LongGuns.id(weaponId)?.XP, 1200);
    assert.equal(
        savedInventory.XPInfo.find(item => item.ItemType == "/Lotus/Weapons/Tenno/LongGuns/Soma/Soma")?.XP,
        1200
    );
    const clientInventory = JSON.parse(responseBody!.InventoryJson!) as {
        LongGuns: { XP: number }[];
    };
    assert.equal(clientInventory.LongGuns[0].XP, 1200);
});

void test("failed arbitration pays completed rotations but quitting and zero rotations do not", async () => {
    for (const [index, status, rotations] of [
        [1, "GS_FAILURE", 4],
        [2, "GS_QUIT", 4],
        [3, "GS_FAILURE", 0],
        [4, "GS_SUCCESS", 4]
    ] as const) {
        const account = await new Account({
            email: `arbitration-${index}@example.com`,
            password: "password",
            DisplayName: `Arbitration${index}`,
            Nonce: 654,
            BuildLabel: "2026.10.22.13.12/",
            DailyFirstWinDate: Math.trunc(Date.now() / 86400000) * 86400
        }).save();
        await new Inventory({ accountOwnerId: account._id, RegularCredits: 100 }).save();
        const report = {
            LevelKeyName: "",
            MissionFailed: status != "GS_SUCCESS",
            MissionStatus: status,
            AliveTime: 900,
            MissionTime: 900,
            GameModeId: 0,
            hosts: [],
            currentClients: [],
            ChallengeProgress: [],
            PS: "",
            ActiveDojoColorResearch: "",
            ReceivedCeremonyMsg: false,
            LastCeremonyResetDate: 0,
            MissionPTS: 42,
            RepHash: `arbitration-report-${index}`,
            EndOfMatchUpload: true,
            ObjectiveReached: rotations > 0,
            sharedSessionId: `0123456789abcdef0123456${index}`,
            FpsAvg: 0,
            FpsMin: 0,
            FpsMax: 0,
            FpsSamples: 0,
            PlayerSkillGains: {},
            RewardInfo: {
                node: "SolNode1",
                periodicMissionTag: "EliteAlert",
                rewardQualifications: "1".repeat(rotations),
                rewardSeed: 123
            }
        } as IMissionInventoryUpdateRequest;

        let responseBody: IMissionInventoryUpdateResponse | undefined;
        const response = {
            json(value: typeof responseBody) {
                responseBody = value;
                return this;
            }
        } as unknown as Response;
        const request = {
            query: { accountId: account._id.toString(), nonce: "654" },
            body: JSON.stringify(report),
            ip: "127.0.0.1"
        } as unknown as Request;

        const runSettlement = async (): Promise<void> => {
            const originalStringify = JSON.stringify;
            try {
                JSON.stringify = JSONStringify;
                await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
            } finally {
                JSON.stringify = originalStringify;
            }
        };
        await runSettlement();

        const rewards = responseBody!.MissionRewards!;
        assert.equal(rewards.length, status == "GS_QUIT" || rotations == 0 ? 0 : 5);
        if (rotations > 0 && status != "GS_QUIT") assert.equal(rewards[0].ItemCount, rotations);
        const rewardVitus = rewards
            .filter(item => item.StoreItem == "/Lotus/StoreItems/Types/Items/MiscItems/Elitium")
            .reduce((sum, item) => sum + item.ItemCount, 0);
        const inventory = (await Inventory.findOne({ accountOwnerId: account._id }))!;
        const vitusItemType = "/Lotus/Types/Items/MiscItems/Elitium";
        assert.equal(inventory.MiscItems.find(item => item.ItemType == vitusItemType)?.ItemCount ?? 0, rewardVitus);
        const visibleInventory = JSON.parse(responseBody!.InventoryJson!) as {
            MiscItems: { ItemType: string; ItemCount: number }[];
            RegularCredits: number;
        };
        assert.equal(
            visibleInventory.MiscItems.find(item => item.ItemType == vitusItemType)?.ItemCount ?? 0,
            rewardVitus
        );
        assert.equal(
            responseBody!.InventoryChanges?.MiscItems?.find(item => item.ItemType == vitusItemType)?.ItemCount ?? 0,
            rewardVitus
        );
        if (status == "GS_FAILURE" && rotations > 0) assert.ok(rewardVitus >= rotations);
        assert.equal(inventory.RegularCredits, status == "GS_SUCCESS" ? 50_100 : 100);
        assert.equal(visibleInventory.RegularCredits, inventory.RegularCredits);

        if (status == "GS_FAILURE" && rotations > 0) {
            await runSettlement();
            assert.deepEqual(responseBody!.MissionRewards, []);
            assert.equal(
                (await Inventory.findOne({ accountOwnerId: account._id }))!.MiscItems.find(
                    item => item.ItemType == vitusItemType
                )?.ItemCount,
                rewardVitus
            );
        }
    }
});

void test("Hex bounty settlement pays the reward table, standing, and chemistry once", async () => {
    const account = await new Account({
        email: "hex-bounty@example.com",
        password: "password",
        DisplayName: "HexBounty",
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/",
        DailyFirstWinDate: Math.trunc(Date.now() / 86400000) * 86400
    }).save();
    const inventory = await new Inventory({ accountOwnerId: account._id, RegularCredits: 100 }).save();
    const report = {
        LevelKeyName: "",
        MissionFailed: false,
        MissionStatus: "GS_SUCCESS",
        AliveTime: 900,
        MissionTime: 900,
        GameModeId: 0,
        hosts: [],
        currentClients: [],
        ChallengeProgress: [],
        PS: "",
        ActiveDojoColorResearch: "",
        ReceivedCeremonyMsg: false,
        LastCeremonyResetDate: 0,
        MissionPTS: 42,
        RepHash: "hex-bounty-report-1",
        EndOfMatchUpload: true,
        ObjectiveReached: true,
        sharedSessionId: "0123456789abcdef01234568",
        FpsAvg: 0,
        FpsMin: 0,
        FpsMax: 0,
        FpsSamples: 0,
        PlayerSkillGains: {},
        Missions: { Tag: "SolNode850", Completes: 1 },
        RewardInfo: {
            node: "SolNode850",
            challengeMissionId: "HexSyndicate_0_0",
            rewardSeed: 123
        }
    } as IMissionInventoryUpdateRequest;

    let responseBody: IMissionInventoryUpdateResponse | undefined;
    const response = {
        json(value: typeof responseBody) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654" },
        body: JSON.stringify(report),
        ip: "127.0.0.1"
    } as unknown as Request;

    const originalStringify = JSON.stringify;
    try {
        JSON.stringify = JSONStringify;
        await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
    } finally {
        JSON.stringify = originalStringify;
    }

    assert.equal(responseBody!.MissionRewards?.length, 1);
    assert.equal(responseBody!.AffiliationMods?.find(mod => mod.Tag == "HexSyndicate")?.Standing, 1_000);
    const savedInventory = (await Inventory.findById(inventory._id))!;
    assert.equal(savedInventory.Affiliations.find(syndicate => syndicate.Tag == "HexSyndicate")?.Standing, 1_000);
    assert.equal(
        savedInventory.DialogueHistory?.Dialogues?.find(dialogue =>
            dialogue.DialogueName.endsWith("JabirDialogue_rom.dialogue")
        )?.Chemistry,
        20
    );

    const duplicateResponse = {
        json(value: typeof responseBody) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    try {
        JSON.stringify = JSONStringify;
        await (missionInventoryUpdateController as RequestHandler)(request, duplicateResponse, () => {});
    } finally {
        JSON.stringify = originalStringify;
    }
    assert.deepEqual(responseBody!.MissionRewards, []);
    assert.equal(
        (await Inventory.findById(inventory._id))!.Affiliations.find(syndicate => syndicate.Tag == "HexSyndicate")
            ?.Standing,
        1_000
    );
});

void test("sessionless Infested Nemesis final settlement clears the lich and grants Coda weapon bucks", async () => {
    const account = await new Account({
        email: "infested-nemesis-final@example.com",
        password: "password",
        DisplayName: "InfestedNemesisFinal",
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/",
        DailyFirstWinDate: Math.trunc(Date.now() / 86400000) * 86400
    }).save();
    const fingerprint = 123456789;
    const inventory = await new Inventory({
        accountOwnerId: account._id,
        RegularCredits: 100,
        Nemesis: {
            fp: fingerprint,
            manifest: "/Lotus/Types/Enemies/InfestedLich/InfestedLichManifest",
            KillingSuit: "/Lotus/Powersuits/Saryn/SarynPrime",
            killingDamageType: 22,
            ShoulderHelmet: "/Lotus/Upgrades/Skins/Saryn/SWSarynIonHelmet",
            WeaponIdx: -1,
            AgentIdx: 2,
            BirthNode: "SolNode854",
            Faction: "FC_INFESTATION",
            Rank: 0,
            k: false,
            Traded: false,
            d: new Date(),
            PrevOwners: 0,
            SecondInCommand: false,
            Weakened: true,
            InfNodes: [{ Node: "CrewBattleNode559", Influence: 1 }],
            HenchmenKilled: 100,
            HintProgress: 0,
            Hints: [],
            GuessHistory: [],
            MissionCount: 0,
            LastEnc: 0
        }
    }).save();
    const report = {
        LevelKeyName: "",
        MissionFailed: false,
        MissionStatus: "GS_SUCCESS",
        AliveTime: 900,
        MissionTime: 900,
        GameModeId: 0,
        hosts: [],
        currentClients: [],
        ChallengeProgress: [],
        PS: "",
        ActiveDojoColorResearch: "",
        ReceivedCeremonyMsg: false,
        LastCeremonyResetDate: 0,
        MissionPTS: 1793045000,
        RepHash: "infested-nemesis-final-1",
        EndOfMatchUpload: true,
        RJ: true,
        ObjectiveReached: true,
        FpsAvg: 0,
        FpsMin: 0,
        FpsMax: 0,
        FpsSamples: 0,
        PlayerSkillGains: {},
        Missions: { Tag: "CrewBattleNode559", Completes: 1, Tier: 0 },
        RewardInfo: { node: "CrewBattleNode559", rewardSeed: 123 },
        Nemesis: 1,
        NemesisKillConvert: {
            nemesisName: "TEST INFESTED LICH",
            weaponLoc: "/Lotus/Language/Weapons/DerelictCernosName",
            petLoc: "",
            fingerprint,
            killed: true
        }
    } as unknown as IMissionInventoryUpdateRequest;

    let responseBody: IMissionInventoryUpdateResponse | undefined;
    const response = {
        json(value: typeof responseBody) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654", xpBasedLevelCapDisabled: "1" },
        body: JSON.stringify(report),
        ip: "127.0.0.1"
    } as unknown as Request;

    const originalStringify = JSON.stringify;
    try {
        JSON.stringify = JSONStringify;
        await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
    } finally {
        JSON.stringify = originalStringify;
    }

    assert.ok(responseBody);
    assert.ok(responseBody.RecoveredItemInfo);
    assert.equal(responseBody.InventoryJson, undefined);
    assert.ok(responseBody.InventoryChanges);
    assert.ok(responseBody.InventoryChanges.ShipDecorations);
    assert.ok(responseBody.InventoryChanges.WeaponSkins);
    assert.ok(responseBody.InventoryChanges.MiscItems);
    const [rotARewardStoreItem, rotBRewardStoreItem] = getInfestedLichItemRewards(BigInt(fingerprint));
    assert.equal(
        responseBody.InventoryChanges.ShipDecorations.find(item => item.ItemType == fromStoreItem(rotARewardStoreItem))
            ?.ItemCount,
        1
    );
    assert.ok(
        responseBody.InventoryChanges.WeaponSkins.some(item => item.ItemType == fromStoreItem(rotBRewardStoreItem))
    );
    assert.ok(
        responseBody.InventoryChanges.WeaponSkins.some(
            item => item.ItemType == "/Lotus/Upgrades/Skins/Sigils/InfLichVanquishedSigil"
        )
    );
    assert.equal(
        responseBody.InventoryChanges.MiscItems.find(
            item => item.ItemType == "/Lotus/Types/Items/MiscItems/CodaWeaponBucks"
        )?.ItemCount,
        getKillTokenRewardCount(BigInt(fingerprint))
    );
    const savedInventory = (await Inventory.findById(inventory._id))!;
    assert.equal(savedInventory.Nemesis, undefined);
    const nemesisHistory = savedInventory.NemesisHistory!;
    assert.equal(nemesisHistory[0].Faction, "FC_INFESTATION");
    assert.equal(nemesisHistory[0].k, true);
    const codaWeaponBucks = savedInventory.MiscItems.find(
        item => item.ItemType == "/Lotus/Types/Items/MiscItems/CodaWeaponBucks"
    )?.ItemCount;
    assert.equal(codaWeaponBucks, getKillTokenRewardCount(BigInt(fingerprint)));
});

void test("aborted Hex bounties sync pickups without paying completion rewards", async () => {
    for (const [index, { status, rewardInfo, syndicateTag }] of [
        {
            status: "GS_QUIT",
            rewardInfo: { node: "SolNode850", challengeMissionId: "HexSyndicate_0_0", rewardSeed: 123 },
            syndicateTag: "HexSyndicate"
        },
        {
            status: "GS_FAILURE",
            rewardInfo: { node: "SolNode850", challengeMissionId: "HexSyndicate_0_0", rewardSeed: 123 },
            syndicateTag: "HexSyndicate"
        },
        {
            status: "GS_QUIT",
            rewardInfo: { node: "SolNode1", jobId: "job-1", JobStage: 0, rewardSeed: 123 },
            syndicateTag: "CetusSyndicate"
        },
        {
            status: "GS_FAILURE",
            rewardInfo: { node: "SolNode1", jobId: "job-1", JobStage: 0, rewardSeed: 123 },
            syndicateTag: "CetusSyndicate"
        }
    ].entries()) {
        const account = await new Account({
            email: `hex-aborted-${index}@example.com`,
            password: "password",
            DisplayName: `HexAborted${index}`,
            Nonce: 654,
            BuildLabel: "2026.10.22.13.12/",
            DailyFirstWinDate: Math.trunc(Date.now() / 86400000) * 86400
        }).save();
        const inventory = await new Inventory({ accountOwnerId: account._id, RegularCredits: 100 }).save();
        const report = {
            LevelKeyName: "",
            MissionFailed: status == "GS_FAILURE",
            MissionStatus: status,
            AliveTime: 90,
            MissionTime: 90,
            GameModeId: 0,
            hosts: [],
            currentClients: [],
            ChallengeProgress: [],
            PS: "",
            ActiveDojoColorResearch: "",
            ReceivedCeremonyMsg: false,
            LastCeremonyResetDate: 0,
            MissionPTS: 42,
            RepHash: `hex-aborted-${index}`,
            EndOfMatchUpload: true,
            ObjectiveReached: false,
            sharedSessionId: `0123456789abcdef0123457${index}`,
            FpsAvg: 0,
            FpsMin: 0,
            FpsMax: 0,
            FpsSamples: 0,
            PlayerSkillGains: {},
            RegularCredits: 25,
            RewardInfo: rewardInfo
        } as IMissionInventoryUpdateRequest;
        let responseBody: IMissionInventoryUpdateResponse | undefined;
        const response = {
            json(value: typeof responseBody) {
                responseBody = value;
                return this;
            }
        } as unknown as Response;
        const request = {
            query: { accountId: account._id.toString(), nonce: "654" },
            body: JSON.stringify(report),
            ip: "127.0.0.1"
        } as unknown as Request;
        const originalStringify = JSON.stringify;
        try {
            JSON.stringify = JSONStringify;
            await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
        } finally {
            JSON.stringify = originalStringify;
        }

        assert.deepEqual(responseBody!.MissionRewards, []);
        const savedInventory = (await Inventory.findById(inventory._id))!;
        assert.equal(savedInventory.RegularCredits, 125);
        assert.equal(
            savedInventory.Affiliations.some(syndicate => syndicate.Tag == syndicateTag),
            false
        );
        assert.equal(savedInventory.DialogueHistory?.Dialogues?.length ?? 0, 0);
    }
});

void test("failed or quit periodic missions do not mark the alert as completed", async () => {
    for (const [index, status] of ["GS_FAILURE", "GS_QUIT"].entries()) {
        const account = await new Account({
            email: `periodic-aborted-${index}@example.com`,
            password: "password",
            DisplayName: `PeriodicAborted${index}`,
            Nonce: 654,
            BuildLabel: "2026.10.22.13.12/"
        }).save();
        const inventory = await new Inventory({ accountOwnerId: account._id }).save();
        const report = {
            LevelKeyName: "",
            MissionFailed: status == "GS_FAILURE",
            MissionStatus: status,
            AliveTime: 60,
            MissionTime: 60,
            GameModeId: 0,
            hosts: [],
            currentClients: [],
            ChallengeProgress: [],
            PS: "",
            ActiveDojoColorResearch: "",
            ReceivedCeremonyMsg: false,
            LastCeremonyResetDate: 0,
            MissionPTS: 42,
            RepHash: `periodic-aborted-${index}`,
            EndOfMatchUpload: true,
            ObjectiveReached: false,
            sharedSessionId: `0123456789abcdef0123458${index}`,
            FpsAvg: 0,
            FpsMin: 0,
            FpsMax: 0,
            FpsSamples: 0,
            PlayerSkillGains: {},
            RewardInfo: {
                node: "SolNode1",
                periodicMissionTag: "EliteAlert",
                rewardQualifications: status == "GS_FAILURE" ? "1111" : ""
            }
        } as IMissionInventoryUpdateRequest;
        let responseBody: IMissionInventoryUpdateResponse | undefined;
        const response = {
            json(value: typeof responseBody) {
                responseBody = value;
                return this;
            }
        } as unknown as Response;
        const request = {
            query: { accountId: account._id.toString(), nonce: "654" },
            body: JSON.stringify(report),
            ip: "127.0.0.1"
        } as unknown as Request;
        const originalStringify = JSON.stringify;
        try {
            JSON.stringify = JSONStringify;
            await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
        } finally {
            JSON.stringify = originalStringify;
        }
        assert.equal((await Inventory.findById(inventory._id))!.PeriodicMissionCompletions.length, 0);
        assert.equal(responseBody!.MissionRewards!.length > 0, status == "GS_FAILURE");
    }
});

void test("bounty stage reports without final-match identity pay once", async () => {
    const account = await new Account({
        email: "stage-bounty@example.com",
        password: "password",
        DisplayName: "StageBounty",
        Nonce: 654,
        BuildLabel: "2026.10.22.13.12/"
    }).save();
    const inventory = await new Inventory({ accountOwnerId: account._id }).save();
    const report = {
        MissionFailed: false,
        MissionPTS: 1792257292,
        RewardInfo: {
            node: "SolNode1",
            jobId: "/Lotus/Types/Gameplay/Eidolon/Jobs/Hunts/TeralystHunt_0_CetusHub1_0123456789abcdef01234567_CetusSyndicate",
            JobStage: 0,
            CheckpointCounter: 1
        }
    } as IMissionInventoryUpdateRequest;
    let responseBody: IMissionInventoryUpdateResponse | undefined;
    const response = {
        json(value: typeof responseBody) {
            responseBody = value;
            return this;
        }
    } as unknown as Response;
    const request = {
        query: { accountId: account._id.toString(), nonce: "654" },
        body: JSON.stringify(report),
        ip: "127.0.0.1"
    } as unknown as Request;
    const runStage = async (): Promise<void> => {
        const originalStringify = JSON.stringify;
        try {
            JSON.stringify = JSONStringify;
            await (missionInventoryUpdateController as RequestHandler)(request, response, () => {});
        } finally {
            JSON.stringify = originalStringify;
        }
    };
    await runStage();
    assert.equal(responseBody!.AffiliationMods?.find(mod => mod.Tag == "CetusSyndicate")?.Standing, 1_000);
    assert.equal(
        (await Inventory.findById(inventory._id))!.Affiliations.find(syndicate => syndicate.Tag == "CetusSyndicate")
            ?.Standing,
        1_000
    );
    await runStage();
    assert.deepEqual(responseBody!.MissionRewards, []);
    assert.equal(
        (await Inventory.findById(inventory._id))!.Affiliations.find(syndicate => syndicate.Tag == "CetusSyndicate")
            ?.Standing,
        1_000
    );
});
