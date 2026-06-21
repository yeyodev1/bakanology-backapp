import "dotenv/config";
import { dbConnect } from "../config/mongo";
import { User } from "../models/User";
import { Payment } from "../models/Payment";

const DEFAULT_EMAIL = "dreyes@bakano.ec";

async function deleteUser(email: string) {
  await dbConnect();

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    console.log(`User not found: ${normalizedEmail}`);
    process.exit(0);
  }

  const paymentsResult = await Payment.deleteMany({ user: user._id });
  const userResult = await User.deleteOne({ _id: user._id });

  console.log("User deleted successfully");
  console.log(`  Email: ${normalizedEmail}`);
  console.log(`  User deleted: ${userResult.deletedCount}`);
  console.log(`  Payments deleted: ${paymentsResult.deletedCount}`);

  process.exit(0);
}

const email = process.argv[2] || DEFAULT_EMAIL;
deleteUser(email).catch((error) => {
  console.error("Error deleting user:", error);
  process.exit(1);
});
