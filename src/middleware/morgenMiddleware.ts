import morgan from "morgan";
import { logger } from "../utils/logger.ts";
import { getClientAddress } from "../services/registrationRateLimitService.ts";

morgan.token("client-addr", request =>
    getClientAddress(request.socket.remoteAddress, request.headers["x-forwarded-for"])
);
morgan.token("request-path", request => request.url?.split("?")[0] || "/");

export const requestLogger = morgan(
    ":client-addr :method :request-path :status :response-time ms - :res[content-length]",
    {
        stream: { write: message => logger.http(message.trim()) }
    }
);
