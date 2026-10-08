import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { repoDir } from "../helpers/pathHelper.ts";
import type { IFeaturePackage, IFeaturePackageManifest } from "../types/featurePackageTypes.ts";
import { signManifest, type IManifestSignature } from "./manifestSignatureService.ts";

const featurePackageRoot = path.join(repoDir, "static", "features");
const manifestPath = path.join(featurePackageRoot, "manifest.json");
const featureIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const featureVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export type IFeaturePackageManifestResponse = IFeaturePackageManifest & { signature: IManifestSignature };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value == "object" && value != null && !Array.isArray(value);

const isOptionalStringArray = (value: unknown): value is string[] | undefined =>
    value == undefined ||
    (Array.isArray(value) && value.every(item => typeof item == "string" && item.length > 0 && item.length <= 128));

const parseFeature = (value: unknown, index: number): IFeaturePackage => {
    if (!isRecord(value)) throw new Error(`Feature manifest entry ${index} is not an object`);
    const { id, version, file, size, sha256, enabled, capabilities, entrypoints, minGameVersion, maxGameVersion } =
        value;
    const validMinGameVersion =
        minGameVersion == undefined ||
        (typeof minGameVersion == "number" && Number.isSafeInteger(minGameVersion) && minGameVersion >= 0);
    const validMaxGameVersion =
        maxGameVersion == undefined ||
        (typeof maxGameVersion == "number" && Number.isSafeInteger(maxGameVersion) && maxGameVersion >= 0);
    if (
        typeof id != "string" ||
        !featureIdPattern.test(id) ||
        typeof version != "string" ||
        !featureVersionPattern.test(version) ||
        typeof file != "string" ||
        file.length == 0 ||
        file.length > 256 ||
        path.isAbsolute(file) ||
        file.includes("\\") ||
        file.split("/").some(part => part == "" || part == "." || part == "..") ||
        !file.endsWith(".pwfpkg") ||
        typeof size != "number" ||
        !Number.isSafeInteger(size) ||
        size < 12 ||
        typeof sha256 != "string" ||
        !sha256Pattern.test(sha256) ||
        (enabled != undefined && typeof enabled != "boolean") ||
        !isOptionalStringArray(capabilities) ||
        !isOptionalStringArray(entrypoints) ||
        !validMinGameVersion ||
        !validMaxGameVersion
    ) {
        throw new Error(`Invalid feature manifest entry ${index}`);
    }
    const normalizedMinGameVersion = typeof minGameVersion == "number" ? minGameVersion : undefined;
    const normalizedMaxGameVersion = typeof maxGameVersion == "number" ? maxGameVersion : undefined;
    if (
        normalizedMinGameVersion != undefined &&
        normalizedMaxGameVersion != undefined &&
        normalizedMinGameVersion > normalizedMaxGameVersion
    ) {
        throw new Error(`Feature manifest entry ${index} has an invalid game version range`);
    }
    return {
        id,
        version,
        file,
        size,
        sha256,
        ...(enabled == undefined ? {} : { enabled }),
        ...(capabilities == undefined ? {} : { capabilities }),
        ...(entrypoints == undefined ? {} : { entrypoints }),
        ...(normalizedMinGameVersion == undefined ? {} : { minGameVersion: normalizedMinGameVersion }),
        ...(normalizedMaxGameVersion == undefined ? {} : { maxGameVersion: normalizedMaxGameVersion })
    };
};

export const readFeaturePackageManifest = (): IFeaturePackageManifest => {
    if (!fs.existsSync(manifestPath)) return { schema: 1, features: [] };
    const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!isRecord(parsed) || parsed.schema !== 1 || !Array.isArray(parsed.features)) {
        throw new Error("Invalid PlayWF feature manifest");
    }
    const features = parsed.features.map(parseFeature);
    const seen = new Set<string>();
    const seenFiles = new Set<string>();
    for (const feature of features) {
        const key = `${feature.id}@${feature.version}`;
        if (seen.has(key)) throw new Error(`Duplicate feature manifest entry: ${key}`);
        if (seenFiles.has(feature.file)) throw new Error(`Duplicate feature package file: ${feature.file}`);
        seen.add(key);
        seenFiles.add(feature.file);
    }
    return { schema: 1, features };
};

export const getSignedFeaturePackageManifest = (): IFeaturePackageManifestResponse =>
    signManifest(readFeaturePackageManifest());

export const verifyFeaturePackage = (feature: IFeaturePackage, filePath: string): boolean => {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size !== feature.size) return false;
    const digest = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    return digest === feature.sha256;
};

export const resolveFeaturePackage = (
    featureId: string,
    version: string
): { feature: IFeaturePackage; filePath: string } | undefined => {
    if (!featureIdPattern.test(featureId) || !featureVersionPattern.test(version)) return undefined;
    const feature = readFeaturePackageManifest().features.find(
        item => item.id == featureId && item.version == version && item.enabled !== false
    );
    if (!feature) return undefined;

    const rootPath = path.resolve(featurePackageRoot);
    const filePath = path.resolve(rootPath, feature.file);
    if (filePath != rootPath && !filePath.startsWith(rootPath + path.sep)) {
        throw new Error("Feature package path escapes its root");
    }
    if (!verifyFeaturePackage(feature, filePath)) throw new Error("Feature package does not match its manifest");
    return { feature, filePath };
};
