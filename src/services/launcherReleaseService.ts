import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { repoDir } from "../helpers/pathHelper.ts";

const launcherRoot = path.join(repoDir, "static", "launcher");
const launcherManifestPath = path.join(launcherRoot, "manifest.json");
const assetNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export interface ILauncherReleaseAsset {
    name: string;
    url: string;
    size: number;
    sha256: string;
}

export interface ILauncherReleaseManifest {
    schema: 1;
    tag: string;
    supported_build_versions: string[];
    supported_game_versions: string[];
    assets: ILauncherReleaseAsset[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value == "object" && value != null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item == "string" && item.length > 0 && item.length <= 64);

const isLauncherAssetUrl = (value: unknown): value is string => {
    if (typeof value != "string" || value.length == 0 || value.length > 2048 || /[\s\\]/.test(value)) return false;
    if (value.startsWith("/") && !value.startsWith("//")) return !value.includes("..");
    try {
        const url = new URL(value);
        return (url.protocol == "http:" || url.protocol == "https:") && url.hostname.length > 0;
    } catch {
        return false;
    }
};

const parseManifest = (value: unknown): ILauncherReleaseManifest => {
    if (!isRecord(value) || value.schema !== 1 || typeof value.tag !== "string" || value.tag.length == 0 || value.tag.length > 128) {
        throw new Error("Invalid launcher release manifest");
    }
    if (!isStringArray(value.supported_build_versions) || !isStringArray(value.supported_game_versions)) {
        throw new Error("Launcher release manifest has invalid supported version lists");
    }
    if (value.supported_build_versions.length == 0 && value.supported_game_versions.length == 0) {
        throw new Error("Launcher release manifest has no supported versions");
    }
    if (!Array.isArray(value.assets) || value.assets.length == 0) {
        throw new Error("Launcher release manifest has no assets");
    }

    const assets: ILauncherReleaseAsset[] = [];
    const seen = new Set<string>();
    for (const [index, item] of value.assets.entries()) {
        if (!isRecord(item)) throw new Error(`Invalid launcher asset ${index}`);
        const { name, url, size, sha256 } = item;
        if (
            typeof name != "string" ||
            !assetNamePattern.test(name) ||
            name.includes("..") ||
            !isLauncherAssetUrl(url) ||
            !Number.isSafeInteger(size) ||
            (size as number) <= 0 ||
            typeof sha256 != "string" ||
            !sha256Pattern.test(sha256) ||
            seen.has(name)
        ) {
            throw new Error(`Invalid launcher asset ${index}`);
        }
        seen.add(name);
        assets.push({ name, url, size: size as number, sha256 });
    }
    if (!assets.some(asset => asset.name == "dwmapi.dll")) {
        throw new Error("Launcher release manifest has no dwmapi.dll asset");
    }
    return {
        schema: 1,
        tag: value.tag,
        supported_build_versions: value.supported_build_versions,
        supported_game_versions: value.supported_game_versions,
        assets
    };
};

const getAssetPath = (assetName: string): string => {
    if (!assetNamePattern.test(assetName) || assetName.includes("..")) throw new Error("Invalid launcher asset name");
    const root = path.resolve(launcherRoot);
    const filePath = path.resolve(root, assetName);
    if (filePath != root && !filePath.startsWith(root + path.sep)) throw new Error("Launcher asset path escapes its root");
    return filePath;
};

const verifyAsset = (asset: ILauncherReleaseAsset, filePath: string): boolean => {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size !== asset.size) return false;
    const digest = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    return digest === asset.sha256;
};

export const readLauncherReleaseManifest = (): ILauncherReleaseManifest => {
    const parsed: unknown = JSON.parse(fs.readFileSync(launcherManifestPath, "utf8"));
    const manifest = parseManifest(parsed);
    for (const asset of manifest.assets) {
        if (asset.url == `/custom/launcher/assets/${asset.name}` && !verifyAsset(asset, getAssetPath(asset.name))) {
            throw new Error(`Launcher asset does not match manifest: ${asset.name}`);
        }
    }
    return manifest;
};

export const resolveLauncherAsset = (assetName: string): { asset: ILauncherReleaseAsset; filePath: string } | undefined => {
    const manifest = readLauncherReleaseManifest();
    const asset = manifest.assets.find(item => item.name == assetName && item.url == `/custom/launcher/assets/${item.name}`);
    if (!asset) return undefined;
    const filePath = getAssetPath(asset.name);
    if (!verifyAsset(asset, filePath)) throw new Error(`Launcher asset does not match manifest: ${asset.name}`);
    return { asset, filePath };
};
