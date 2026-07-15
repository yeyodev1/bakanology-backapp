import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/customError.error";
import { successResponse } from "../helpers/response.helper";
import { sendMetaEvent, type MetaBrowserEventName } from "../services/metaConversions.service";

const browserEvents = new Set<MetaBrowserEventName>(["PageView", "AddToCart"]);

export async function trackBrowserEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventName, eventId, sourceUrl, fbp, fbc, customData } = req.body;
    if (!browserEvents.has(eventName) || typeof eventId !== "string" || typeof sourceUrl !== "string") {
      throw new CustomError("Invalid Meta event", 400);
    }
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(eventId)) throw new CustomError("Invalid Meta event ID", 400);

    const forwardedFor = req.headers["x-forwarded-for"];
    const clientIpAddress = typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim()
      : req.ip;
    const result = await sendMetaEvent({
      eventName,
      eventId,
      sourceUrl,
      userData: {
        clientIpAddress,
        clientUserAgent: req.get("user-agent"),
        fbp: typeof fbp === "string" ? fbp.slice(0, 255) : undefined,
        fbc: typeof fbc === "string" ? fbc.slice(0, 255) : undefined,
      },
      customData: customData && typeof customData === "object" ? customData : undefined,
    });
    successResponse(res, result, "Meta event received");
  } catch (error) {
    next(error);
  }
}
