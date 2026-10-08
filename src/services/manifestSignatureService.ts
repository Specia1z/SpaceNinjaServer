import crypto from "node:crypto";
import fs from "node:fs";

export const manifestSignatureAlgorithm = "rsa-pss-sha256" as const;
export const manifestSigningKeyId = process.env.PLAYWF_MANIFEST_SIGNING_KEY_ID ?? "playwf-release-2026-01";

export interface IManifestSignature {
    algorithm: typeof manifestSignatureAlgorithm;
    key_id: string;
    signature: string;
}

const canonicalize = (value: unknown): string => {
    if (value === null) return "null";
    if (typeof value == "string") return JSON.stringify(value);
    if (typeof value == "boolean") return value ? "true" : "false";
    if (typeof value == "number") {
        if (!Number.isFinite(value)) throw new Error("Manifest contains a non-finite number");
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    if (typeof value == "object") {
        const object = value as Record<string, unknown>;
        return `{${Object.keys(object)
            .sort()
            .map(key => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
            .join(",")}}`;
    }
    throw new Error("Manifest contains an unsupported value");
};

const loadSigningKey = (): crypto.KeyObject => {
    const keyPath = process.env.PLAYWF_MANIFEST_SIGNING_KEY_PATH;
    const keyPem = process.env.PLAYWF_MANIFEST_SIGNING_KEY_PEM;
    if (keyPath) return crypto.createPrivateKey(fs.readFileSync(keyPath));
    if (keyPem) return crypto.createPrivateKey(keyPem);
    throw new Error("PLAYWF_MANIFEST_SIGNING_KEY_PATH or PLAYWF_MANIFEST_SIGNING_KEY_PEM is not configured");
};

export const signManifest = <T extends object>(manifest: T): T & { signature: IManifestSignature } => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(manifestSigningKeyId)) {
        throw new Error("PLAYWF_MANIFEST_SIGNING_KEY_ID is invalid");
    }
    const payload = Buffer.from(canonicalize(manifest), "utf8");
    const signature = crypto.sign("sha256", payload, {
        key: loadSigningKey(),
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    });
    return {
        ...manifest,
        signature: {
            algorithm: manifestSignatureAlgorithm,
            key_id: manifestSigningKeyId,
            signature: signature.toString("base64url")
        }
    };
};
