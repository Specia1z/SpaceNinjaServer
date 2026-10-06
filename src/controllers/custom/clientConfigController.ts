import type { RequestHandler } from "express";

import { config, type IClientConfig } from "../../services/configService.ts";

const clientConfigKeys = [
    "fallback_language",
    "fallback_languageVO",
    "fallback_graphicsDriver",
    "fallback_windowMode",
    "fallback_cluster",
    "language",
    "server_host",
    "http_port",
    "https_port",
    "secure_connections",
    "high_damage_numbers_patch",
    "skip_mission_start_timer",
    "disable_profanity_filter",
    "logout_on_request_failure",
    "fov_override",
    "simulacrum_blacklisted",
    "simulacrum_whitelisted",
    "pause_always_stops_time",
    "disable_firewall_prompt",
    "ee_log_in_console",
    "alternative_loading",
    "save_all_metadata",
    "write_all_metadata_reads_to_console",
    "write_all_metadata_reads_to_ee_log",
    "write_patched_metadata_reads_to_console",
    "write_patched_metadata_reads_to_ee_log",
    "client_http_logging",
    "disable_overlay",
    "overlay_compatibility_mode",
    "keep_console_open"
] as const satisfies readonly (keyof IClientConfig)[];

export const clientConfigController: RequestHandler = (req, res) => {
    const publicConfig: Partial<IClientConfig> = {
        server_host: config.client?.server_host ?? req.hostname,
        http_port: config.client?.http_port ?? config.httpPort ?? 80,
        https_port: config.client?.https_port ?? config.httpsPort ?? 443
    };
    for (const key of clientConfigKeys) {
        const value = config.client?.[key];
        if (value !== undefined) publicConfig[key] = value as never;
    }
    res.json(publicConfig);
};
