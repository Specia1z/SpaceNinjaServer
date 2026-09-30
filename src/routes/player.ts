import express from "express";
import path from "path";
import { args } from "../helpers/commandLineArguments.ts";
import { repoDir, rootDir } from "../helpers/pathHelper.ts";
import {
    getPlayerAdminPolicyController,
    approvePlayerReferralController,
    getPlayerPolicyController,
    playerMeController,
    playerLoginController,
    playerLogoutController,
    playerPasswordController,
    playerRegisterController,
    playerRenameController,
    resetPlayerRenameCooldownController,
    setPlayerAdminPolicyController
} from "../controllers/playerPortalController.ts";

const playerRouter = express.Router();
const baseDir = args.dev ? repoDir : rootDir;

playerRouter.get(["/", "/login", "/dashboard"], (_req, res) => {
    res.sendFile(path.join(baseDir, "static/player/index.html"));
});
playerRouter.use("/assets", express.static(path.join(baseDir, "static/player/assets")));
playerRouter.post("/api/login", playerLoginController);
playerRouter.post("/api/register", playerRegisterController);
playerRouter.post("/api/logout", playerLogoutController);
playerRouter.get("/api/me", playerMeController);
playerRouter.get("/api/policy", getPlayerPolicyController);
playerRouter.post("/api/rename", playerRenameController);
playerRouter.post("/api/password", playerPasswordController);
playerRouter.get("/api/admin/policy", getPlayerAdminPolicyController);
playerRouter.post("/api/admin/policy", setPlayerAdminPolicyController);
playerRouter.post("/api/admin/reset-rename-cooldown", resetPlayerRenameCooldownController);
playerRouter.post("/api/admin/approve-referral", approvePlayerReferralController);

export { playerRouter };
