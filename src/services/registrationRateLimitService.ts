import { isIP } from "node:net";
import { config } from "./configService.ts";

interface IRegistrationAttempt {
    time: number;
}

type IReservation = { allowed: false; retryAfterSeconds: number } | { allowed: true; cancel: () => void };

const attemptsByAddress = new Map<string, IRegistrationAttempt[]>();
const globalRegistrations: IRegistrationAttempt[] = [];
const globalAttempts: IRegistrationAttempt[] = [];
let lastAddressSweep = 0;

const normaliseAddress = (address: string | undefined): string => address?.replace(/^::ffff:/, "") || "unknown";

export const getRegistrationAddress = (
    remoteAddress: string | undefined,
    forwardedFor: string | string[] | undefined
): string => {
    let address = normaliseAddress(remoteAddress);
    const trusted = new Set(config.registrationRateLimit?.trustedProxies?.map(normaliseAddress) ?? []);
    if (!trusted.has(address)) return address;
    const hops = (Array.isArray(forwardedFor) ? forwardedFor.join(",") : (forwardedFor ?? "")).split(",");
    for (const hop of hops.reverse()) {
        const next = normaliseAddress(hop.trim());
        if (!isIP(next)) break;
        address = next;
        if (!trusted.has(address)) break;
    }
    return address;
};

const positiveInteger = (value: number | undefined, fallback: number): number =>
    typeof value == "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;

const prune = (attempts: IRegistrationAttempt[], cutoff: number): void => {
    while (attempts.length && attempts[0].time <= cutoff) attempts.shift();
};

export const reserveRegistration = (address: string, now = Date.now()): IReservation => {
    const settings = config.registrationRateLimit;
    const windowMs = positiveInteger(settings?.windowMinutes, 1440) * 60_000;
    const cutoff = now - windowMs;
    prune(globalRegistrations, cutoff);
    prune(globalAttempts, cutoff);
    if (now < lastAddressSweep || now - lastAddressSweep >= 60_000) {
        for (const [key, attempts] of attemptsByAddress) {
            prune(attempts, cutoff);
            if (!attempts.length) attemptsByAddress.delete(key);
        }
        lastAddressSweep = now;
    }

    const key = normaliseAddress(address);
    const attempts = attemptsByAddress.get(key) ?? [];
    prune(attempts, cutoff);
    if (!attempts.length) attemptsByAddress.delete(key);
    const perAddressLimit = positiveInteger(settings?.perAddress, 3);
    const globalLimit = positiveInteger(settings?.global, 100);
    const globalAttemptsLimit = positiveInteger(settings?.globalAttempts, 1000);
    if (
        attempts.length >= perAddressLimit ||
        globalRegistrations.length >= globalLimit ||
        globalAttempts.length >= globalAttemptsLimit
    ) {
        const perAddressRetry = attempts.length >= perAddressLimit ? attempts[0].time + windowMs - now : 0;
        const globalRetry =
            globalRegistrations.length >= globalLimit ? globalRegistrations[0].time + windowMs - now : 0;
        const globalAttemptsRetry =
            globalAttempts.length >= globalAttemptsLimit ? globalAttempts[0].time + windowMs - now : 0;
        return {
            allowed: false,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil(Math.max(perAddressRetry, globalRetry, globalAttemptsRetry) / 1000)
            )
        };
    }

    const attempt = { time: now };
    attempts.push(attempt);
    attemptsByAddress.set(key, attempts);
    globalRegistrations.push(attempt);
    globalAttempts.push(attempt);
    return {
        allowed: true,
        cancel: (): void => {
            const index = globalRegistrations.indexOf(attempt);
            if (index != -1) globalRegistrations.splice(index, 1);
            // A failed registration still consumes an address attempt, preventing repeated expensive writes.
        }
    };
};
