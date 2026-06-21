import type { Response, NextFunction } from "express";
import * as launchReminderService from "../services/launchReminder.service";
import { CustomError } from "../errors/customError.error";
import type { AuthRequest } from "../types/AuthRequest";

export async function createReminder(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = req.body;
    const userId = req.user?.userId;

    if (!email && !userId) {
      throw new CustomError("Se requiere un correo electrónico", 400);
    }

    const finalEmail = email || req.user?.email;
    if (!finalEmail) {
      throw new CustomError("No se pudo determinar el correo electrónico", 400);
    }

    const result = await launchReminderService.createReminder(finalEmail, userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
