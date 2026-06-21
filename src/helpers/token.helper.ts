import jwt from "jsonwebtoken";
import crypto from "crypto";

export function generateAccessToken(payload: {
  userId: string;
  email: string;
  accountType: string;
}): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
