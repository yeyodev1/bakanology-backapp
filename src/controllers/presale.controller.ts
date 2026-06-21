import { Request, Response, NextFunction } from "express";
import { successResponse } from "../helpers/response.helper";
import * as presaleService from "../services/presale.service";

export async function getStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status = presaleService.getStatus();
    successResponse(res, status, "Presale status retrieved successfully");
  } catch (error) {
    next(error);
  }
}
