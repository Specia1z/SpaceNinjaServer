import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const packageName = "warframe-public-export-plus";
const registryUrl = `https://registry.npmjs.org/${packageName}/latest`;
const maximumPackageBytes = 256 * 1024 * 1024;

export const parseVersion = version => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
    if (!match) {
        throw new Error(`Invalid semantic version: ${version}`);
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4]?.split(".") ?? []
    };
};

const comparePrerelease = (left, right) => {
    if (left.length === 0 || right.length === 0) {
        return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
    }
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if (left[index] === undefined || right[index] === undefined) {
            return left[index] === right[index] ? 0 : left[index] === undefined ? -1 : 1;
        }
        if (left[index] === right[index]) {
            continue;
        }
        const leftNumber = /^\d+$/.test(left[index]) ? Number(left[index]) : undefined;
        const rightNumber = /^\d+$/.test(right[index]) ? Number(right[index]) : undefined;
        if (leftNumber !== undefined && rightNumber !== undefined) {
            return Math.sign(leftNumber - rightNumber);
        }
        if (leftNumber !== undefined || rightNumber !== undefined) {
            return leftNumber !== undefined ? -1 : 1;
        }
        return left[index].localeCompare(right[index]);
    }
    return 0;
};

export const compareVersions = (leftVersion, rightVersion) => {
    const left = parseVersion(leftVersion);
    const right = parseVersion(rightVersion);
    for (const key of ["major", "minor", "patch"]) {
        if (left[key] !== right[key]) {
            return Math.sign(left[key] - right[key]);
        }
    }
    return comparePrerelease(left.prerelease, right.prerelease);
};

export const decideUpdate = (currentVersion, latestVersion, applyUpdate) => {
    if (compareVersions(latestVersion, currentVersion) <= 0) {
        return "current";
    }
    const current = parseVersion(currentVersion);
    const latest = parseVersion(latestVersion);
    if (current.major !== latest.major || current.minor !== latest.minor) {
        return "incompatible";
    }
    return applyUpdate ? "apply" : "available";
};

export const validateArchiveEntries = entries => {
    if (entries.length === 0) {
        throw new Error("Public Export archive is empty");
    }
    for (const entry of entries) {
        if (!entry || entry.includes("\\") || entry.startsWith("/")) {
            throw new Error(`Unsafe archive path: ${entry}`);
        }
        const parts = entry.replace(/\/$/, "").split("/");
        if (parts[0] !== "package" || parts.some((part, index) => index > 0 && ["", ".", ".."].includes(part))) {
            throw new Error(`Unsafe archive path: ${entry}`);
        }
    }
};

const envEnabled = (value, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }
    return !["0", "false", "no", "off"].includes(value.toLowerCase());
};

const readManifest = packageRoot =>
    JSON.parse(readFileSync(resolve(packageRoot, "node_modules", packageName, "package.json"), "utf8"));

const fetchWithTimeout = async (url, timeoutMs, accept = "application/json") => {
    const response = await fetch(url, {
        headers: { Accept: accept, "User-Agent": "SpaceNinjaServer Public Export updater" },
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return response;
};

const fetchLatestMetadata = async timeoutMs => {
    const metadata = await (await fetchWithTimeout(registryUrl, timeoutMs)).json();
    if (metadata.name !== packageName || typeof metadata.version !== "string") {
        throw new Error("npm registry returned invalid Public Export metadata");
    }
    if (typeof metadata.dist?.tarball !== "string" || typeof metadata.dist?.integrity !== "string") {
        throw new Error("npm registry metadata is missing tarball integrity data");
    }
    const tarballUrl = new URL(metadata.dist.tarball);
    if (tarballUrl.protocol !== "https:" || tarballUrl.hostname !== "registry.npmjs.org") {
        throw new Error("npm registry returned a non-official Public Export tarball URL");
    }
    if (Number(metadata.dist.unpackedSize ?? 0) > maximumPackageBytes) {
        throw new Error("Public Export package exceeds the 256 MiB unpacked size limit");
    }
    return metadata;
};

const verifyIntegrity = (archive, integrity) => {
    const token = integrity.split(/\s+/).find(value => value.startsWith("sha512-"));
    if (!token) {
        throw new Error("Public Export package has no SHA-512 integrity value");
    }
    const expected = token.slice("sha512-".length);
    const actual = createHash("sha512").update(archive).digest("base64");
    if (actual !== expected) {
        throw new Error("Public Export package SHA-512 verification failed");
    }
};

const assertNoSymlinks = directory => {
    for (const entry of readdirSync(directory)) {
        const entryPath = join(directory, entry);
        const stat = lstatSync(entryPath);
        if (stat.isSymbolicLink()) {
            throw new Error(`Public Export archive contains a symbolic link: ${entry}`);
        }
        if (stat.isDirectory()) {
            assertNoSymlinks(entryPath);
        }
    }
};

const extractAndInstall = (archive, metadata, packageRoot) => {
    const nodeModules = resolve(packageRoot, "node_modules");
    const cacheRoot = resolve(nodeModules, ".cache");
    mkdirSync(cacheRoot, { recursive: true });
    const temporaryRoot = mkdtempSync(join(cacheRoot, "public-export-"));
    const archivePath = resolve(temporaryRoot, "package.tgz");
    const extractRoot = resolve(temporaryRoot, "extract");
    mkdirSync(extractRoot);
    writeFileSync(archivePath, archive);

    try {
        const listResult = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8", timeout: 30_000 });
        if (listResult.status !== 0) {
            throw new Error(`Unable to inspect Public Export archive: ${listResult.stderr || listResult.error}`);
        }
        validateArchiveEntries(listResult.stdout.split(/\r?\n/).filter(Boolean));
        const verboseListResult = spawnSync("tar", ["-tvzf", archivePath], {
            encoding: "utf8",
            timeout: 30_000
        });
        if (verboseListResult.status !== 0) {
            throw new Error(
                `Unable to inspect Public Export archive types: ${verboseListResult.stderr || verboseListResult.error}`
            );
        }
        for (const line of verboseListResult.stdout.split(/\r?\n/).filter(Boolean)) {
            const entryType = line.trimStart()[0];
            if (entryType !== "-" && entryType !== "d") {
                throw new Error(`Public Export archive contains an unsupported link or entry type: ${entryType}`);
            }
        }

        const extractResult = spawnSync("tar", ["-xzf", archivePath, "-C", extractRoot], {
            encoding: "utf8",
            timeout: 120_000
        });
        if (extractResult.status !== 0) {
            throw new Error(`Unable to extract Public Export archive: ${extractResult.stderr || extractResult.error}`);
        }

        const extractedPackage = resolve(extractRoot, "package");
        assertNoSymlinks(extractedPackage);
        const extractedManifest = JSON.parse(readFileSync(resolve(extractedPackage, "package.json"), "utf8"));
        if (extractedManifest.name !== packageName || extractedManifest.version !== metadata.version) {
            throw new Error("Extracted Public Export package does not match registry metadata");
        }
        if (!existsSync(resolve(extractedPackage, "index.js")) || !existsSync(resolve(extractedPackage, "index.mjs"))) {
            throw new Error("Extracted Public Export package is missing its runtime entry points");
        }

        const target = resolve(nodeModules, packageName);
        const backup = resolve(nodeModules, `${packageName}.backup-${process.pid}`);
        rmSync(backup, { recursive: true, force: true });
        renameSync(target, backup);
        try {
            renameSync(extractedPackage, target);
            if (readManifest(packageRoot).version !== metadata.version) {
                throw new Error("Installed Public Export version failed post-update verification");
            }
            rmSync(backup, { recursive: true, force: true });
        } catch (error) {
            rmSync(target, { recursive: true, force: true });
            renameSync(backup, target);
            throw error;
        }
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
};

export const runUpdater = async ({
    argv = process.argv.slice(2),
    env = process.env,
    packageRoot = process.cwd()
} = {}) => {
    const manualApply = argv.includes("--apply");
    const automaticApply = argv.includes("--auto") && envEnabled(env.PUBLIC_EXPORT_AUTO_UPDATE, false);
    if (!manualApply && !envEnabled(env.PUBLIC_EXPORT_CHECK_UPDATES, true)) {
        console.log("[public-export] Update check disabled; using bundled snapshot.");
        return;
    }

    const currentManifest = readManifest(packageRoot);
    const configuredTimeout = Number(env.PUBLIC_EXPORT_UPDATE_TIMEOUT_MS ?? 10_000);
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 10_000;
    const configuredDownloadTimeout = Number(env.PUBLIC_EXPORT_DOWNLOAD_TIMEOUT_MS ?? 120_000);
    const downloadTimeoutMs =
        Number.isFinite(configuredDownloadTimeout) && configuredDownloadTimeout > 0
            ? configuredDownloadTimeout
            : 120_000;
    const metadata = await fetchLatestMetadata(timeoutMs);
    const action = decideUpdate(currentManifest.version, metadata.version, manualApply || automaticApply);

    if (action === "current") {
        console.log(`[public-export] Bundled snapshot ${currentManifest.version} is current.`);
        return;
    }
    if (action === "incompatible") {
        console.warn(
            `[public-export] Version ${metadata.version} is available, but automatic updates are limited to ${currentManifest.version.split(".").slice(0, 2).join(".")}.x. Upgrade SpaceNinjaServer instead.`
        );
        return;
    }
    if (action === "available") {
        console.log(
            `[public-export] Version ${metadata.version} is available (bundled: ${currentManifest.version}). Set PUBLIC_EXPORT_AUTO_UPDATE=1 to apply compatible updates before startup.`
        );
        return;
    }

    console.log(`[public-export] Updating ${currentManifest.version} -> ${metadata.version} before startup...`);
    const archiveResponse = await fetchWithTimeout(
        metadata.dist.tarball,
        downloadTimeoutMs,
        "application/octet-stream"
    );
    const contentLength = Number(archiveResponse.headers.get("content-length") ?? 0);
    if (contentLength > maximumPackageBytes) {
        throw new Error("Public Export tarball exceeds the 256 MiB download limit");
    }
    const archive = Buffer.from(await archiveResponse.arrayBuffer());
    if (archive.byteLength > maximumPackageBytes) {
        throw new Error("Public Export tarball exceeds the 256 MiB download limit");
    }
    verifyIntegrity(archive, metadata.dist.integrity);
    extractAndInstall(archive, metadata, packageRoot);
    console.log(`[public-export] Updated to ${metadata.version}.`);
};

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntrypoint) {
    const manualApply = process.argv.includes("--apply");
    try {
        await runUpdater();
    } catch (error) {
        console.warn(`[public-export] Update check failed; continuing with bundled snapshot: ${error.message}`);
        if (manualApply) {
            process.exitCode = 1;
        }
    }
}
