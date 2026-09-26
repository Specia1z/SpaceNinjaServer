import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { args } from "../helpers/commandLineArguments.ts";
import { config } from "./configService.ts";

export const isValidIrcAnnouncement = (message: unknown): message is string =>
    typeof message == "string" &&
    Boolean(message.trim()) &&
    ![...message].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) == 127) &&
    Buffer.byteLength(message, "utf8") <= 400;

export const sendIrcAnnouncement = async (message: string): Promise<void> => {
    const baseUrl =
        config.ircManagementUrl ?? (args.docker ? "http://warframe-irc-server:6688" : "http://127.0.0.1:6688");
    const url = new URL(baseUrl);
    if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Invalid IRC management URL");

    url.pathname = "/redtext";
    url.search = `?${encodeURIComponent(message)}`;
    await new Promise<void>((resolve, reject) => {
        let flushed = false;
        let settled = false;
        const finish = (error?: Error): void => {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            if (error) reject(error);
            else resolve();
        };
        // Upstream broadcasts /redtext but never replies. A flushed request is a submission, not delivery proof.
        const request = (url.protocol == "https:" ? httpsGet : httpGet)(url, response => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
                body += chunk;
            });
            response.on("end", () => {
                if (!response.statusCode || response.statusCode >= 400 || !body.includes("OK")) {
                    finish(new Error("IRC management service rejected announcement"));
                } else {
                    finish();
                }
            });
        });
        const watchdog = setTimeout(() => {
            finish(new Error("Could not connect to the IRC management service"));
            request.destroy();
        }, 5000);
        request.on("finish", () => {
            flushed = true;
        });
        request.on("error", (error: NodeJS.ErrnoException) => {
            if (flushed && error.code == "ECONNRESET") finish();
            else finish(error);
        });
        request.setTimeout(1500, () => {
            finish(flushed ? undefined : new Error("IRC announcement was not submitted"));
            request.destroy();
        });
    });
};
