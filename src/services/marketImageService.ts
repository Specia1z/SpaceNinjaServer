import fs from "fs/promises";
import path from "path";
import { repoDir } from "../helpers/pathHelper.ts";

const publicExportRoot = path.join(repoDir, "static", "data", "PublicExport");
const imageSourceRoot = "https://browse.wf";
const pendingDownloads = new Map<string, Promise<void>>();

const validIcon = (icon: string): boolean => /^\/Lotus\/Interface\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg)$/i.test(icon);

const localPathFor = (icon: string): string => path.join(publicExportRoot, icon.slice(1));
const localUrlFor = (icon: string): string => `/PublicExport${icon}`;

const downloadIcon = async (icon: string): Promise<void> => {
    if (!validIcon(icon)) return;
    const target = localPathFor(icon);
    try {
        await fs.access(target);
        return;
    } catch {
        // The bundled snapshot does not contain all UI textures.
    }
    const directory = path.dirname(target);
    await fs.mkdir(directory, { recursive: true });
    const response = await fetch(`${imageSourceRoot}${icon}`, {
        headers: {
            Accept: "image/avif,image/webp,image/png,image/jpeg",
            "User-Agent": "SpaceNinjaServer market image cache"
        },
        signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`market image returned HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) throw new Error("market image has an invalid size");
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
        await fs.writeFile(temporary, bytes, { flag: "wx" });
        await fs.rename(temporary, target);
    } finally {
        await fs.rm(temporary, { force: true });
    }
};

const startDownload = (icon: string): void => {
    if (pendingDownloads.has(icon)) return;
    const pending = downloadIcon(icon)
        .catch(() => undefined)
        .finally(() => pendingDownloads.delete(icon));
    pendingDownloads.set(icon, pending);
};

export const resolveMarketIcon = async (icon: string | undefined): Promise<string | undefined> => {
    if (!icon || !validIcon(icon)) return undefined;
    try {
        await fs.access(localPathFor(icon));
        return localUrlFor(icon);
    } catch {
        startDownload(icon);
        return `${imageSourceRoot}${icon}`;
    }
};
