import type { RequestHandler } from "express";
import { BL_LATEST } from "../../constants/gameVersions.ts";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import { getAdminItemDataStatus, syncAdminItemData } from "../../services/adminItemDataService.ts";
import {
    deleteStoreOverride,
    listStoreOverridePage,
    saveStoreOverride,
    syncStoreOverridePrices
} from "../../services/storeOverrideService.ts";
import {
    deleteSupplementalStorePrice,
    listOfficialStorePricePage,
    listOfficialStorePrices,
    saveSupplementalStorePrice,
    syncOfficialStorePrices
} from "../../services/officialStorePriceService.ts";
import { deleteStoreBundle, listStoreBundlePage, saveStoreBundle } from "../../services/storeBundleService.ts";
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
const STORE_CATEGORIES: readonly string[] = [
    "NEW_PLAYER",
    "NEW",
    "POPULAR",
    "SEASONAL",
    "COMMUNITY",
    "HEIRLOOM",
    "TENNOGEN",
    "SALE",
    "WISH_LIST",
    "QUICK_BUY"
];

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
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize);
    const search = typeof req.query.search == "string" ? req.query.search : "";
    res.json(await listStoreOverridePage(page, pageSize, search));
};

export const listOfficialStorePricesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    res.json(await listOfficialStorePrices());
};

export const listOfficialStorePricePageController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize);
    const search = typeof req.query.search == "string" ? req.query.search : "";
    res.json(await listOfficialStorePricePage(page, pageSize, search));
};

export const saveSupplementalStorePriceController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const body = req.body as Record<string, unknown>;
    const typeName = body.TypeName;
    if (typeof typeName != "string" || !typeName.startsWith("/Lotus/") || typeName.length > 300) {
        throw new Error("Invalid TypeName");
    }
    const premiumPrice = optionalInteger(body.PremiumPrice, "PremiumPrice");
    const regularPrice = optionalInteger(body.RegularPrice, "RegularPrice");
    if (premiumPrice === undefined && regularPrice === undefined) {
        throw new Error("At least one price is required");
    }
    res.json(await saveSupplementalStorePrice(typeName, premiumPrice, regularPrice));
};

export const deleteSupplementalStorePriceController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const typeName = (req.body as Record<string, unknown>).TypeName;
    if (typeof typeName != "string") throw new Error("Invalid TypeName");
    res.json({ deleted: await deleteSupplementalStorePrice(typeName) });
};

export const syncOfficialStorePricesController: RequestHandler = async (req, res) => {
    const account = await getAdministrator(req);
    const official = await syncOfficialStorePrices();
    const overrides = await syncStoreOverridePrices(account.DisplayName, BL_LATEST);
    res.json({ official, overrides });
};

export const listStoreBundlesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize);
    res.json(await listStoreBundlePage(page, pageSize));
};

export const saveStoreBundleController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const body = req.body as Record<string, unknown>;
    const typeName = body.TypeName;
    if (
        typeof typeName != "string" ||
        (!typeName.startsWith("/Lotus/StoreItems/") && !typeName.startsWith("/Lotus/Types/StoreItems/")) ||
        typeName.length > 300
    ) {
        throw new Error("Invalid bundle TypeName");
    }
    if (!Array.isArray(body.Components)) throw new Error("Bundle components are required");
    const components = body.Components.map((value, index) => {
        if (value === null || typeof value != "object" || Array.isArray(value)) {
            throw new Error(`Invalid bundle component ${index + 1}`);
        }
        const component = value as Record<string, unknown>;
        const componentTypeName = component.TypeName;
        if (
            typeof componentTypeName != "string" ||
            !componentTypeName.startsWith("/Lotus/") ||
            componentTypeName.length > 300
        ) {
            throw new Error(`Invalid bundle component ${index + 1} TypeName`);
        }
        const purchaseQuantity = component.PurchaseQuantity;
        if (typeof purchaseQuantity != "number" || !Number.isInteger(purchaseQuantity)) {
            throw new Error(`Invalid bundle component ${index + 1} quantity`);
        }
        const durabilityDays = component.DurabilityDays;
        if (durabilityDays !== undefined && (typeof durabilityDays != "number" || !Number.isInteger(durabilityDays))) {
            throw new Error(`Invalid bundle component ${index + 1} duration`);
        }
        return {
            TypeName: componentTypeName,
            PurchaseQuantity: purchaseQuantity,
            ...(durabilityDays !== undefined ? { DurabilityDays: durabilityDays } : {})
        };
    });
    res.json(await saveStoreBundle(typeName, components));
};

export const deleteStoreBundleController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const typeName = (req.body as Record<string, unknown>).TypeName;
    if (
        typeof typeName != "string" ||
        (!typeName.startsWith("/Lotus/StoreItems/") && !typeName.startsWith("/Lotus/Types/StoreItems/"))
    ) {
        throw new Error("Invalid bundle TypeName");
    }
    res.json({ deleted: await deleteStoreBundle(typeName) });
};

const optionalNumber = (value: unknown, name: string, max?: number): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value != "number" || !Number.isFinite(value) || value < 0 || (max !== undefined && value > max)) {
        throw new Error(`Invalid ${name}`);
    }
    return value;
};

const optionalInteger = (value: unknown, name: string, max?: number): number | undefined => {
    const parsed = optionalNumber(value, name, max);
    if (parsed !== undefined && !Number.isInteger(parsed)) throw new Error(`Invalid ${name}`);
    return parsed;
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
    const categoryStartDate = optionalDate(body.CategoryStartDate, "CategoryStartDate");
    const categoryEndDate = optionalDate(body.CategoryEndDate, "CategoryEndDate");
    if (categoryStartDate && categoryEndDate && categoryStartDate >= categoryEndDate) {
        throw new Error("CategoryEndDate must be after CategoryStartDate");
    }
    const productExpiryDate = optionalDate(body.ProductExpiryDate, "ProductExpiryDate");
    if (startDate && productExpiryDate && productExpiryDate <= startDate) {
        throw new Error("ProductExpiryDate must be after StartDate");
    }
    const discountPercent = optionalNumber(body.DiscountPercent, "DiscountPercent", 100);
    const premiumPrice = optionalNumber(body.PremiumPrice, "PremiumPrice");
    const regularPrice = optionalNumber(body.RegularPrice, "RegularPrice");
    const bogoBuy = optionalInteger(body.BogoBuy, "BogoBuy");
    const bogoGet = optionalInteger(body.BogoGet, "BogoGet");
    const bannerIndex = optionalInteger(body.BannerIndex, "BannerIndex");
    const listed = body.Listed !== false;
    if (body.Purchasable !== undefined && typeof body.Purchasable != "boolean") {
        throw new Error("Invalid Purchasable");
    }
    if (body.Giftable !== undefined && typeof body.Giftable != "boolean") {
        throw new Error("Invalid Giftable");
    }
    if (
        body.GiftingBonus !== undefined &&
        (typeof body.GiftingBonus != "string" ||
            !body.GiftingBonus.startsWith("/Lotus/") ||
            body.GiftingBonus.length > 300 ||
            body.GiftingBonus.includes("\n") ||
            body.GiftingBonus.includes("\r"))
    ) {
        throw new Error("Invalid GiftingBonus");
    }
    if (body.SupporterPack !== undefined && typeof body.SupporterPack != "boolean") {
        throw new Error("Invalid SupporterPack");
    }
    if (body.Featured !== undefined && typeof body.Featured != "boolean") {
        throw new Error("Invalid Featured");
    }
    if (body.Popular !== undefined && typeof body.Popular != "boolean") {
        throw new Error("Invalid Popular");
    }
    if (body.PurchaseMode !== undefined && !["platinum", "steam"].includes(body.PurchaseMode)) {
        throw new Error("Invalid PurchaseMode");
    }
    if (body.CategoryName !== undefined && !STORE_CATEGORIES.includes(body.CategoryName)) {
        throw new Error("Invalid CategoryName");
    }
    if ((categoryStartDate || categoryEndDate) && body.CategoryName === undefined) {
        throw new Error("CategoryName is required when category timing is configured");
    }
    const override: IStoreOverride = {
        TypeName: body.TypeName,
        Enabled: body.Enabled !== false,
        Listed: listed,
        Purchasable: listed && (body.Purchasable ?? true),
        Giftable: body.Giftable,
        GiftingBonus: body.GiftingBonus?.trim() || undefined,
        PurchaseMode: body.PurchaseMode,
        CategoryName: body.CategoryName,
        DiscountPercent: discountPercent,
        PremiumPrice: premiumPrice,
        RegularPrice: regularPrice,
        SupporterPack: body.SupporterPack,
        BogoBuy: bogoBuy,
        BogoGet: bogoGet,
        Featured: body.Featured,
        Popular: body.Popular,
        BannerIndex: bannerIndex,
        CategoryStartDate: categoryStartDate,
        CategoryEndDate: categoryEndDate,
        ProductExpiryDate: productExpiryDate,
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
