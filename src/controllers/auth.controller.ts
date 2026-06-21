import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/AuthRequest";
import { CustomError } from "../errors/customError.error";
import { successResponse } from "../helpers/response.helper";
import * as authService from "../services/auth.service";

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

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { name, lastName, email, password } = req.body;
    if (!name || !lastName || !email || !password) {
      throw new CustomError("Incomplete data", 400);
    }
    const frontendUrl = getFrontendUrl(req);
    const result = await authService.register(
      name,
      lastName,
      email,
      password,
      frontendUrl,
    );
    successResponse(
      res,
      result,
      "User registered successfully. Check your email to verify your account.",
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      throw new CustomError("Token required", 400);
    }
    const result = await authService.verifyEmail(token);
    successResponse(res, result, "Email verified successfully");
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new CustomError("Incomplete data", 400);
    }
    const result = await authService.login(email, password);
    successResponse(res, result, "User logged in successfully");
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const user = await authService.getMe(req.user.userId);
    successResponse(res, { user }, "User profile retrieved successfully");
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const { name, lastName, email } = req.body;
    const user = await authService.updateProfile(req.user.userId, {
      name,
      lastName,
      email,
    });
    successResponse(res, { user }, "Profile updated successfully");
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new CustomError("Incomplete data", 400);
    }
    await authService.changePassword(
      req.user.userId,
      currentPassword,
      newPassword,
    );
    successResponse(res, {}, "Password changed successfully");
  } catch (error) {
    next(error);
  }
}

export async function uploadProfilePicture(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    if (!req.file) {
      throw new CustomError("No image file provided", 400);
    }

    const user = await authService.uploadProfilePicture(
      req.user.userId,
      req.file.buffer,
      req.file.mimetype,
    );

    successResponse(
      res,
      { user },
      "Profile picture uploaded successfully",
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = req.body;
    if (!email) {
      throw new CustomError("Email required", 400);
    }
    const frontendUrl = getFrontendUrl(req);
    const result = await authService.forgotPassword(email, frontendUrl);
    successResponse(
      res,
      result,
      "Password reset instructions sent to your email",
    );
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      throw new CustomError("Token and new password required", 400);
    }
    const result = await authService.resetPassword(token, newPassword);
    successResponse(
      res,
      result,
      "Password reset successfully. You can now log in with your new password.",
    );
  } catch (error) {
    next(error);
  }
}
