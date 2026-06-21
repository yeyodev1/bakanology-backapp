import { Response } from "express";

export function successResponse(
  res: Response,
  data: unknown,
  message: string,
  status = 200,
) {
  res.status(status).json({ data, message });
}
