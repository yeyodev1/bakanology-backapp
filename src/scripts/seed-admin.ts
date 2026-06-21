import { User } from "../models/User";
import { hashPassword } from "../helpers/password.helper";

const ADMIN_EMAIL = "dreyes@bakano.ec";
const ADMIN_PASSWORD = "123456789";

export async function seedAdmin() {
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existing) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
      return;
    }

    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    await User.create({
      name: "Diego",
      lastName: "Reyes",
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      subscriptionStatus: "active",
      accessUntil: null,
    });

    console.log(`Admin user created: ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}
