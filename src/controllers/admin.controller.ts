import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/AuthRequest";
import { CustomError } from "../errors/customError.error";
import { successResponse } from "../helpers/response.helper";
import * as adminService from "../services/admin.service";

function getFrontendUrl(req: Request): string {
  const origin = req.headers.origin || req.headers.referer;
  const fallback = process.env.FRONTEND_URL || "http://localhost:5173";

  if (!origin) {
    return fallback.replace(/\/$/, "");
  }

  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback.replace(/\/$/, "");
  }
}

export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.listUsers(req.query as {
      role?: string;
      subscriptionStatus?: string;
      search?: string;
      page?: string;
      limit?: string;
    });
    successResponse(res, result, "Users retrieved successfully");
  } catch (error) {
    next(error);
  }
}

export async function createUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);

    const { name, lastName, email, role, accessMonths, password } = req.body;
    if (!name || !lastName || !email || !role) {
      throw new CustomError("Incomplete data", 400);
    }

    if (role !== "user" && role !== "admin") {
      throw new CustomError("Invalid role", 400);
    }

    const frontendUrl = getFrontendUrl(req);
    const user = await adminService.createUser(
      name,
      lastName,
      email,
      role,
      accessMonths,
      password,
      frontendUrl,
    );

    successResponse(res, { user }, "User created successfully", 201);
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);

    const id = req.params.id as string;
    const result = await adminService.deleteUser(id);
    successResponse(res, result, "User deleted successfully");
  } catch (error) {
    next(error);
  }
}

export async function updateAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);

    const id = req.params.id as string;
    const action = req.body.action as string;
    const months = req.body.months;

    if (!action || (action !== "extend" && action !== "revoke")) {
      throw new CustomError("Invalid action", 400);
    }

    let result;
    if (action === "extend") {
      if (!Number.isFinite(Number(months)) || Number(months) <= 0) {
        throw new CustomError("Invalid months value", 400);
      }
      result = await adminService.extendAccess(id, Number(months));
    } else {
      result = await adminService.revokeAccess(id);
    }

    successResponse(res, { user: result }, "Access updated successfully");
  } catch (error) {
    next(error);
  }
}

export async function setFoundingMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);

    const id = req.params.id as string;
    const { foundingMember } = req.body;
    if (typeof foundingMember !== "boolean") {
      throw new CustomError("foundingMember must be a boolean", 400);
    }

    const result = await adminService.setFoundingMember(id, foundingMember);
    successResponse(
      res,
      { user: result },
      `Founding member ${foundingMember ? "enabled" : "disabled"} successfully`,
    );
  } catch (error) {
    next(error);
  }
}
