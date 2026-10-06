import type { RequestHandler } from "express";

import { readLauncherReleaseManifest, resolveLauncherAsset } from "../../services/launcherReleaseService.ts";

export const launcherManifestController: RequestHandler = (_req, res) => {
    try {
        res.setHeader("Cache-Control", "no-cache");
        res.json(readLauncherReleaseManifest());
    } catch {
        res.status(503).send("Launcher release unavailable");
    }
};

export const launcherAssetController: RequestHandler = (req, res) => {
    const assetName = typeof req.params.assetName == "string" ? req.params.assetName : "";
    try {
        const resolved = resolveLauncherAsset(assetName);
        if (!resolved) {
            res.status(404).send("Launcher asset not found");
            return;
        }
        res.type("application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("Content-Length", resolved.asset.size);
        res.setHeader("X-PlayWF-Launcher-SHA256", resolved.asset.sha256);
        res.sendFile(resolved.filePath, _error => {
            if (!res.headersSent) res.status(500).send("Launcher asset unavailable");
        });
    } catch {
        res.status(503).send("Launcher asset unavailable");
    }
};
