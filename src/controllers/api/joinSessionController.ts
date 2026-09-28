import type { RequestHandler } from "express";
import { getSessionByID, reserveSessionSlot } from "../../services/sessionService.ts";
import { logger } from "../../utils/logger.ts";
import { getAccountForRequest, getBuildLabel } from "../../services/loginService.ts";
import { toOid2 } from "../../helpers/inventoryHelpers.ts";
import { generateRewardSeed } from "../../services/rngService.ts";

export const joinSessionGetController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const buildLabel = getBuildLabel(req, account);
    const sessionId = req.query.sessionId as string;
    const session = await reserveSessionSlot([sessionId], account._id);
    if (!session) {
        const knownSession = await getSessionByID(sessionId);
        if (knownSession) {
            logger.warn(`session ${sessionId} has no available slots`);
            res.json({});
            return;
        }
        logger.warn(`joining an unknown session; rewardSeed will not be in sync`);
    }
    res.json({
        rewardSeed: session?.rewardSeed ?? generateRewardSeed(),
        sessionId: toOid2(sessionId, buildLabel)
    });
};

export const joinSessionPostController: RequestHandler = async (req, res) => {
    const account = await getAccountForRequest(req);
    const buildLabel = getBuildLabel(req, account);
    const reqBody = JSON.parse(String(req.body)) as IJoinSessionRequest;
    logger.debug(`JoinSession Request`, { reqBody });
    const sessionId = reqBody.sessionIds[0];
    if (!sessionId) {
        res.json({});
        return;
    }
    const session = await reserveSessionSlot(reqBody.sessionIds, account._id);
    if (!session) {
        const knownSessions = await Promise.all(reqBody.sessionIds.map(candidate => getSessionByID(candidate)));
        const unknownIndex = knownSessions.findIndex(candidate => candidate == null);
        if (unknownIndex == -1) {
            logger.warn(`none of the requested sessions have available slots`);
            res.json({});
            return;
        }
        const unknownSessionId = reqBody.sessionIds[unknownIndex];
        logger.warn(`joining unknown session ${unknownSessionId}; rewardSeed will not be in sync`);
        res.json({
            rewardSeed: generateRewardSeed(),
            sessionId: toOid2(unknownSessionId, buildLabel)
        });
        return;
    }
    res.json({
        rewardSeed: session.rewardSeed,
        sessionId: toOid2(session._id, buildLabel)
    });
};

interface IJoinSessionRequest {
    sessionIds: string[];
}
