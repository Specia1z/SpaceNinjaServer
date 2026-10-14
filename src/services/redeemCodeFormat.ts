import { randomBytes, randomUUID } from "node:crypto";
import { MAX_REDEEM_CODE_LENGTH } from "../models/redeemCodeModel.ts";

export type TRedeemCodeFormat = "random" | "uuid" | "uuid-compact";
export type TRedeemCodeAlphabet = "unambiguous" | "alphanumeric" | "hex" | "digits" | "custom";

export interface IRedeemCodeFormatInput {
    Format?: unknown;
    CodeLength?: unknown;
    Prefix?: unknown;
    Alphabet?: unknown;
    CustomAlphabet?: unknown;
    GroupSize?: unknown;
    Separator?: unknown;
}

export interface INormalizedRedeemCodeFormat {
    Format: TRedeemCodeFormat;
    CodeLength: number;
    Prefix: string;
    Alphabet: TRedeemCodeAlphabet;
    CustomAlphabet: string;
    GroupSize: number;
    Separator: string;
    AlphabetCharacters: string;
}

const MIN_CODE_LENGTH = 4;
const DEFAULT_CODE_LENGTH = 16;
const CODE_ALPHABETS: Record<Exclude<TRedeemCodeAlphabet, "custom">, string> = {
    unambiguous: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
    alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    hex: "0123456789ABCDEF",
    digits: "0123456789"
};
const CODE_FORMATS: readonly TRedeemCodeFormat[] = ["random", "uuid", "uuid-compact"];
const CODE_ALPHABET_NAMES: readonly TRedeemCodeAlphabet[] = ["unambiguous", "alphanumeric", "hex", "digits", "custom"];
const CODE_SEPARATORS = ["-", "_", "."];

export const normalizeRedeemCodeFormat = (input: IRedeemCodeFormatInput): INormalizedRedeemCodeFormat => {
    const format = input.Format === undefined ? "random" : input.Format;
    if (typeof format != "string" || !CODE_FORMATS.includes(format as TRedeemCodeFormat)) {
        throw new Error("Format must be random, uuid, or uuid-compact");
    }

    const prefixValue = input.Prefix ?? "";
    if (typeof prefixValue != "string") throw new Error("Prefix must be a string");
    const prefix = prefixValue.trim().toUpperCase();
    if (prefix.length > 24 || (prefix && !/^[A-Z0-9-]+$/.test(prefix))) {
        throw new Error("Prefix may contain at most 24 letters, digits, or hyphens");
    }

    if (format != "random") {
        const codeLength = format == "uuid" ? 36 : 32;
        if (prefix.length + codeLength > MAX_REDEEM_CODE_LENGTH) {
            throw new Error(`Prefix and UUID must fit within ${MAX_REDEEM_CODE_LENGTH} characters`);
        }
        return {
            Format: format as TRedeemCodeFormat,
            CodeLength: codeLength,
            Prefix: prefix,
            Alphabet: "unambiguous",
            CustomAlphabet: "",
            GroupSize: 0,
            Separator: "-",
            AlphabetCharacters: CODE_ALPHABETS.unambiguous
        };
    }

    const codeLength = input.CodeLength ?? DEFAULT_CODE_LENGTH;
    if (
        typeof codeLength != "number" ||
        !Number.isInteger(codeLength) ||
        codeLength < MIN_CODE_LENGTH ||
        codeLength > MAX_REDEEM_CODE_LENGTH
    ) {
        throw new Error(`CodeLength must be a whole number between ${MIN_CODE_LENGTH} and ${MAX_REDEEM_CODE_LENGTH}`);
    }

    const alphabetName = input.Alphabet === undefined ? "unambiguous" : input.Alphabet;
    if (typeof alphabetName != "string" || !CODE_ALPHABET_NAMES.includes(alphabetName as TRedeemCodeAlphabet)) {
        throw new Error("Alphabet must be unambiguous, alphanumeric, hex, digits, or custom");
    }

    let customAlphabet = "";
    let alphabetCharacters: string;
    if (alphabetName == "custom") {
        if (typeof input.CustomAlphabet != "string") throw new Error("CustomAlphabet must be a string");
        customAlphabet = input.CustomAlphabet.toUpperCase();
        if (!/^[A-Z0-9]{2,36}$/.test(customAlphabet) || new Set(customAlphabet).size != customAlphabet.length) {
            throw new Error("CustomAlphabet must contain 2 to 36 unique letters or digits");
        }
        alphabetCharacters = customAlphabet;
    } else {
        alphabetCharacters = CODE_ALPHABETS[alphabetName as Exclude<TRedeemCodeAlphabet, "custom">];
    }

    const groupSize = input.GroupSize ?? 0;
    if (
        typeof groupSize != "number" ||
        !Number.isInteger(groupSize) ||
        (groupSize != 0 && (groupSize < 2 || groupSize > 16))
    ) {
        throw new Error("GroupSize must be 0 (disabled) or a whole number between 2 and 16");
    }
    const separator = input.Separator ?? "-";
    if (typeof separator != "string" || !CODE_SEPARATORS.includes(separator)) {
        throw new Error("Separator must be a hyphen, underscore, or period");
    }

    const separatorCount = groupSize ? Math.floor((codeLength - 1) / groupSize) : 0;
    if (prefix.length + codeLength + separatorCount * separator.length > MAX_REDEEM_CODE_LENGTH) {
        throw new Error(`Prefix, code length, and separators must fit within ${MAX_REDEEM_CODE_LENGTH} characters`);
    }

    return {
        Format: "random",
        CodeLength: codeLength,
        Prefix: prefix,
        Alphabet: alphabetName as TRedeemCodeAlphabet,
        CustomAlphabet: customAlphabet,
        GroupSize: groupSize,
        Separator: separator,
        AlphabetCharacters: alphabetCharacters
    };
};

const generateRandomBody = (length: number, alphabet: string): string => {
    const acceptanceLimit = Math.floor(256 / alphabet.length) * alphabet.length;
    let code = "";
    while (code.length < length) {
        const bytes = randomBytes(Math.max(16, length - code.length));
        for (const byte of bytes) {
            if (byte >= acceptanceLimit) continue;
            code += alphabet[byte % alphabet.length];
            if (code.length == length) break;
        }
    }
    return code;
};

const groupCode = (code: string, groupSize: number, separator: string): string => {
    if (!groupSize) return code;
    const groups: string[] = [];
    for (let index = 0; index < code.length; index += groupSize) {
        groups.push(code.slice(index, index + groupSize));
    }
    return groups.join(separator);
};

export const generateRedeemCode = (format: INormalizedRedeemCodeFormat): string => {
    let body: string;
    if (format.Format == "uuid") {
        body = randomUUID().toUpperCase();
    } else if (format.Format == "uuid-compact") {
        body = randomUUID().replaceAll("-", "").toUpperCase();
    } else {
        body = groupCode(
            generateRandomBody(format.CodeLength, format.AlphabetCharacters),
            format.GroupSize,
            format.Separator
        );
    }
    return `${format.Prefix}${body}`;
};
