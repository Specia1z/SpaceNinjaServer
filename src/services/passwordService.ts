import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PREFIX = "scrypt:v1";

export const hashAccountPassword = async (password: string): Promise<string> => {
    const salt = randomBytes(24);
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    return `${PREFIX}:${salt.toString("hex")}:${hash.toString("hex")}`;
};

export const verifyAccountPassword = async (password: string, stored: string): Promise<boolean> => {
    if (!stored.startsWith(`${PREFIX}:`)) {
        const actual = Buffer.from(password);
        const expected = Buffer.from(stored);
        return actual.length == expected.length && timingSafeEqual(actual, expected);
    }
    const parts = stored.split(":");
    if (parts.length != 4 || !/^[a-f0-9]{48}$/.test(parts[2]) || !/^[a-f0-9]{128}$/.test(parts[3])) return false;
    const actual = (await scrypt(password, Buffer.from(parts[2], "hex"), 64)) as Buffer;
    return timingSafeEqual(actual, Buffer.from(parts[3], "hex"));
};
