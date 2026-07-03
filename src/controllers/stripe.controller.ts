import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/customError.error";
import { successResponse } from "../helpers/response.helper";
import * as stripeService from "../services/stripe.service";

export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, name, lastName, origin } = req.body;
    if (!email || !name || !lastName) {
      throw new CustomError("Incomplete data", 400);
    }

    const result = await stripeService.createCheckoutSession({
      email,
      name,
      lastName,
      origin,
    });
    successResponse(res, result, "Checkout session created successfully");
  } catch (error) {
    next(error);
  }
}

export async function verifyPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      throw new CustomError("Session ID required", 400);
    }

    const result = await stripeService.verifySession(sessionId);
    const message =
      result.status === "approved"
        ? "Payment approved successfully"
        : "Payment not completed";
    successResponse(res, result, message);
  } catch (error) {
    next(error);
  }
}

export async function resendEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { sessionId } = req.body;
    if (!sessionId) throw new CustomError("Session ID required", 400);

    const result = await stripeService.resendWelcomeEmail(sessionId);
    successResponse(res, result, "Welcome email resent");
  } catch (error) {
    next(error);
  }
}

export async function handleWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const rawBody = (req as any).rawBody;
  const signature = String(req.headers["stripe-signature"] || "");

  const result = await stripeService.handleWebhook(rawBody, signature);
  res.json(result);
}
