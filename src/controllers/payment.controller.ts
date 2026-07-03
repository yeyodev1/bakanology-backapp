import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/AuthRequest";
import { CustomError } from "../errors/customError.error";
import { successResponse } from "../helpers/response.helper";
import * as paymentService from "../services/payment.service";

export async function history(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const result = await paymentService.getHistory(req.user.userId);
    successResponse(res, result, "Payment history retrieved successfully");
  } catch (error) {
    next(error);
  }
}

export async function cancelPending(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const result = await paymentService.cancelPendingPayments(req.user.userId);
    successResponse(res, result, "Pending payments canceled successfully");
  } catch (error) {
    next(error);
  }
}

export async function cancelSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const result = await paymentService.cancelSubscription(req.user.userId);
    successResponse(res, result, "Subscription canceled successfully");
  } catch (error) {
    next(error);
  }
}
