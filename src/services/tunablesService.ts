import crypto from "node:crypto";
import { args } from "../helpers/commandLineArguments.ts";
import type { ITunables } from "../types/bootstrapperTypes.ts";
import { config, type IMetadataPatchConfig } from "./configService.ts";

let secret;
if (args.secret) {
    secret = args.secret; // Maintain same secret across hot reloads in dev mode
} else {
    secret = "";
    for (let i = 0; i != 10; ++i) {
        secret += String.fromCharCode(Math.floor(Math.random() * 26) + 0x41);
    }
}

export const getTokenForClient = (clientAddress: string): string => {
    return crypto.createHmac("sha256", secret).update(clientAddress).digest("hex");
};

export const compileMetadataPatches = (patches: IMetadataPatchConfig[] = []): string => {
    const lines: string[] = [];
    for (const patch of patches) {
        if (patch.enabled === false) {
            continue;
        }

        const targets = Array.isArray(patch.targets)
            ? patch.targets
                  .filter(target => typeof target == "string")
                  .map(target => target.trim())
                  .filter(target => target.startsWith("/") && !target.includes("\n") && !target.includes("\r"))
            : [];
        if (targets.length == 0) {
            continue;
        }

        if (typeof patch.name == "string" && patch.name) {
            lines.push(`# Server patch: ${patch.name.replaceAll(/[\r\n]/g, " ")}`);
        }
        lines.push(targets.join(" & "));
        for (const operation of Array.isArray(patch.operations) ? patch.operations : []) {
            if (typeof operation != "string") {
                continue;
            }
            lines.push(...operation.replaceAll("\r", "").split("\n"));
        }
        lines.push("");
    }
    return lines.join("\n").trimEnd();
};

export const getTunablesForClient = (clientAddress: string, reflexiveAddress: string): ITunables => {
    const tunables: ITunables = {
        // To successfully update the NRS address for pre-U15.14 clients, this needs to be set before login.
        nrs: ((config.nrsAddresses ?? [])[0] || "%THIS_MACHINE%").replaceAll("%THIS_MACHINE%", reflexiveAddress),

        // if (version_compare(buildLabel, gameToBuildVersion["16.5.5"]) < 0) {
        irc: (config.ircAddress || "%THIS_MACHINE%").replaceAll("%THIS_MACHINE%", reflexiveAddress)
    };
    if (config.tunables?.useLoginToken) {
        tunables.token = getTokenForClient(clientAddress);
    }
    if (config.tunables?.prohibitSkipMissionStartTimer) {
        tunables.prohibit_skip_mission_start_timer = true;
    }
    if (config.tunables?.prohibitDisableProfanityFilter) {
        tunables.prohibit_disable_profanity_filter = true;
    }
    if (config.tunables?.prohibitFovOverride) {
        tunables.prohibit_fov_override = true;
    }
    if (config.tunables?.prohibitFreecam) {
        tunables.prohibit_freecam = true;
    }
    if (config.tunables?.prohibitTeleport) {
        tunables.prohibit_teleport = true;
    }
    if (config.tunables?.prohibitScripts) {
        tunables.prohibit_scripts = true;
    }
    if (config.tunables?.prohibitLocalMetadataPatches) {
        tunables.prohibit_local_metadata_patches = true;
    }
    if (config.tunables?.motd) {
        tunables.motd = config.tunables.motd;
    }
    if (config.tunables?.udpProxyUpstream) {
        tunables.udp_proxy_upstream = config.tunables.udpProxyUpstream.replaceAll("%THIS_MACHINE%", reflexiveAddress);
    }
    const metadataPatches = compileMetadataPatches(config.tunables?.metadataPatches);
    if (metadataPatches) {
        tunables.metadata_patches = metadataPatches;
        tunables.metadata_patches_revision = crypto.createHash("sha256").update(metadataPatches).digest("hex");
    }
    return tunables;
};
