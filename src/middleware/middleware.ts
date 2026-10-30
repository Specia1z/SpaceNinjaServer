import { logger } from "../utils/logger.ts";
import type { NextFunction, Request, Response } from "express";
import { getClientAddress, isBlockedClientAddress } from "../services/registrationRateLimitService.ts";

export const clientAddressBlocker = (request: Request, response: Response, next: NextFunction): void => {
    const address = getClientAddress(request.socket.remoteAddress, request.headers["x-forwarded-for"]);
    if (isBlockedClientAddress(address)) {
        logger.warn(`blocked client ${address} ${request.method} ${request.path}`);
        response.sendStatus(403);
        return;
    }
    next();
};

const unknownEndpointHandler = (request: Request, response: Response): void => {
    const address = getClientAddress(request.socket.remoteAddress, request.headers["x-forwarded-for"]);
    logger.warn(`unknown endpoint ${request.method} ${request.path} from ${address}`);
    if (request.body) {
        logger.debug(`data provided to ${request.path}: ${String(request.body)}`);
    }
    response.status(404).json({ error: "endpoint was not found" });
};

// const requestLogger = (request: Request, _response: Response, next: NextFunction) => {
//     console.log("Method:", request.method);
//     console.log("Path:  ", request.path);
//     console.log("Body:  ", request.body);
//     console.log("---");
//     next();
// };

export { unknownEndpointHandler };
