import type { RequestHandler } from "express";
import { getAccountForRequest, isAdministrator, type TAccountDocument } from "../../services/loginService.ts";
import {
    deleteDropTableOverride,
    getDropTableDetail,
    isDropTablePath,
    listDropTablePage,
    normalizeDropTableOverride,
    saveDropTableOverride
} from "../../services/dropTableOverrideService.ts";

const getAdministrator = async (req: Parameters<RequestHandler>[0]): Promise<TAccountDocument> => {
    const account = await getAccountForRequest(req);
    if (!isAdministrator(account)) throw new Error("Administrator permission required");
    return account;
};

export const listDropTableOverridesController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize);
    const search = typeof req.query.search == "string" ? req.query.search : "";
    const language = typeof req.query.lang == "string" ? req.query.lang : "en";
    res.json(listDropTablePage(page, pageSize, search, language));
};

export const getDropTableDetailController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const dropTable = req.query.DropTable;
    if (!isDropTablePath(dropTable)) throw new Error("Invalid drop table path");
    const language = typeof req.query.lang == "string" ? req.query.lang : "en";
    res.json(getDropTableDetail(dropTable, language));
};

export const saveDropTableOverrideController: RequestHandler = async (req, res) => {
    const account = await getAdministrator(req);
    const body = req.body as Record<string, unknown>;
    const normalized = normalizeDropTableOverride({
        DropTable: body.DropTable,
        Enabled: body.Enabled,
        Pools: body.Pools,
        UpdatedBy: account.DisplayName
    });
    res.json(await saveDropTableOverride(normalized));
};

export const deleteDropTableOverrideController: RequestHandler = async (req, res) => {
    await getAdministrator(req);
    const dropTable = (req.body as Record<string, unknown>).DropTable;
    if (!isDropTablePath(dropTable)) throw new Error("Invalid drop table path");
    res.json({ deleted: await deleteDropTableOverride(dropTable) });
};
