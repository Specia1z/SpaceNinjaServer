import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { getAdminItemDataStatus, syncAdminItemData } from "../../services/adminItemDataService.ts";
import { deleteStoreOverride, listStoreOverrides, saveStoreOverride } from "../../services/storeOverrideService.ts";
import {
    deleteCraftingConfig,
    getCraftingOverride,
    listCraftingConfigs,
    saveCraftingConfig
} from "../../services/craftingConfigService.ts";
import { SERVER_WIDE_CRAFTING_KEY, type ICraftingConfig } from "../../models/craftingConfigModel.ts";
import type { IStoreOverride } from "../../models/storeOverrideModel.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

const RUSH_COST_MODES: readonly string[] = ["stock", "free", "custom"];

export const getAdminItemDataStatusController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json(await getAdminItemDataStatus());
};

export const syncAdminItemDataController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json(await syncAdminItemData());
};

export const listStoreOverridesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json(await listStoreOverrides());
};

const optionalNumber = (value: unknown, name: string, max?: number): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value != "number" || !Number.isFinite(value) || value < 0 || (max !== undefined && value > max)) {
        throw new Error(`Invalid ${name}`);
    }
    return value;
};

const optionalDate = (value: unknown, name: string): Date | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value != "string") throw new Error(`Invalid ${name}`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${name}`);
    return date;
};

export const saveStoreOverrideController: RequestHandler = async (req, res) => {
    const account = await getAdministrator(req);
    const body = req.body as Partial<IStoreOverride>;
    if (typeof body.TypeName != "string" || !body.TypeName.startsWith("/Lotus/") || body.TypeName.length > 300) {
        throw new Error("Invalid TypeName");
    }
    const startDate = optionalDate(body.StartDate, "StartDate");
    const endDate = optionalDate(body.EndDate, "EndDate");
    if (startDate && endDate && startDate >= endDate) throw new Error("EndDate must be after StartDate");
    const discountPercent = optionalNumber(body.DiscountPercent, "DiscountPercent", 100);
    const premiumPrice = optionalNumber(body.PremiumPrice, "PremiumPrice");
    const regularPrice = optionalNumber(body.RegularPrice, "RegularPrice");
    const hasAnyPrice = discountPercent !== undefined || premiumPrice !== undefined || regularPrice !== undefined;
    // An override that only delists an item carries no pricing, which is a valid configuration.
    const onlyDelists = body.Listed === false && body.Enabled !== false;
    if (!hasAnyPrice && !onlyDelists) {
        throw new Error("An override requires a discount percentage or a sale price");
    }
    const override: IStoreOverride = {
        TypeName: body.TypeName,
        Enabled: body.Enabled !== false,
        Listed: body.Listed !== false,
        DiscountPercent: discountPercent,
        PremiumPrice: premiumPrice,
        RegularPrice: regularPrice,
        StartDate: startDate,
        EndDate: endDate,
        UpdatedBy: account.DisplayName
    };
    res.json(await saveStoreOverride(override));
};

export const deleteStoreOverrideController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const body = req.body as { TypeName?: unknown };
    if (typeof body.TypeName != "string") throw new Error("Invalid TypeName");
    res.json({ deleted: await deleteStoreOverride(body.TypeName) });
};

export const getCraftingConfigController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json({
        configs: await listCraftingConfigs(),
        // Exposes the effective policy so the editor can show what the modes actually resolve to.
        effective: getCraftingOverride("")
    });
};

export const saveCraftingConfigController: RequestHandler = async (req, res) => {
    const account = await getAdministrator(req);
    const body = req.body as Partial<ICraftingConfig>;

    const speedMode = body.SpeedMode;
    if (speedMode !== "default" && speedMode !== "instant" && speedMode !== "custom") {
        throw new Error("Invalid SpeedMode");
    }
    const buildTimeSeconds = body.BuildTimeSeconds;
    if (
        speedMode == "custom" &&
        (typeof buildTimeSeconds != "number" ||
            !Number.isInteger(buildTimeSeconds) ||
            buildTimeSeconds < 0 ||
            buildTimeSeconds > 31_536_000)
    ) {
        throw new Error("BuildTimeSeconds must be a whole number of seconds between 0 and 31536000 (1 year)");
    }
    const costMultiplier = body.CostMultiplier;
    if (
        typeof costMultiplier != "number" ||
        !Number.isFinite(costMultiplier) ||
        costMultiplier < 0 ||
        costMultiplier > 100
    ) {
        throw new Error("CostMultiplier must be between 0 and 100");
    }
    // A missing field means "stock", so older clients that never send it keep the game data value.
    const rushCostMode = body.RushCostMode ?? "stock";
    if (!RUSH_COST_MODES.includes(rushCostMode)) {
        throw new Error("Invalid RushCostMode");
    }
    const rushCostPlatinum = body.RushCostPlatinum;
    if (
        rushCostMode == "custom" &&
        (typeof rushCostPlatinum != "number" ||
            !Number.isInteger(rushCostPlatinum) ||
            rushCostPlatinum < 0 ||
            rushCostPlatinum > 1_000_000)
    ) {
        throw new Error("RushCostPlatinum must be a whole number of Platinum between 0 and 1000000");
    }
    const typeName = body.TypeName;
    if (
        typeName !== undefined &&
        (typeof typeName != "string" || !typeName.startsWith("/Lotus/") || typeName.length > 300)
    ) {
        throw new Error("Invalid TypeName");
    }

    const config: ICraftingConfig = {
        Key: typeName ?? SERVER_WIDE_CRAFTING_KEY,
        SpeedMode: speedMode,
        BuildTimeSeconds: buildTimeSeconds ?? 0,
        CostMultiplier: costMultiplier,
        RushCostMode: rushCostMode,
        RushCostPlatinum: rushCostPlatinum ?? 0,
        KeepBlueprints: body.KeepBlueprints === true,
        TypeName: typeName,
        UpdatedBy: account.DisplayName
    };
    res.json(await saveCraftingConfig(config));
};

export const deleteCraftingConfigController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const body = req.body as { Key?: unknown };
    if (typeof body.Key != "string") throw new Error("Invalid Key");
    res.json({ deleted: await deleteCraftingConfig(body.Key) });
};
