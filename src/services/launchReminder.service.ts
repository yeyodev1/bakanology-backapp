import { LaunchReminder } from "../models/LaunchReminder";
import { CustomError } from "../errors/customError.error";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createReminder(email: string, userId?: string) {
  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    throw new CustomError("Correo electrónico inválido", 400);
  }

  const existing = await LaunchReminder.findOne({ email: normalizedEmail });
  if (existing) {
    return { email: normalizedEmail, alreadyRegistered: true };
  }

  const reminder = await LaunchReminder.create({
    email: normalizedEmail,
    user: userId || null,
  });

  return {
    email: reminder.email,
    alreadyRegistered: false,
  };
}
