import type { RequestHandler } from "express";

import { readFeaturePackageManifest, resolveFeaturePackage } from "../../services/featurePackageService.ts";

export const featureManifestController: RequestHandler = (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.json(readFeaturePackageManifest());
};

export const featurePackageController: RequestHandler = (req, res) => {
    const featureId = typeof req.params.featureId == "string" ? req.params.featureId : "";
    const version = typeof req.params.version == "string" ? req.params.version : "";
    try {
        const resolved = resolveFeaturePackage(featureId, version);
        if (!resolved) {
            res.status(404).send("Feature package not found");
            return;
        }
        res.type("application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("Content-Length", resolved.feature.size);
        res.setHeader("X-PlayWF-Feature-SHA256", resolved.feature.sha256);
        res.sendFile(resolved.filePath, _error => {
            if (!res.headersSent) res.status(500).send("Feature package unavailable");
        });
    } catch {
        res.status(503).send("Feature package unavailable");
    }
};
