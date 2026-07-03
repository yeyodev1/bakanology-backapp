import "dotenv/config";
import { dbConnect } from "../config/mongo";
import { User } from "../models/User";
import { Payment } from "../models/Payment";
import { ManualPayment } from "../models/ManualPayment";
import { LaunchReminder } from "../models/LaunchReminder";

async function deleteUser(email: string) {
  await dbConnect();

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    console.log(`User not found: ${normalizedEmail}`);
    process.exit(0);
  }

  const [paymentsResult, manualResult, remindersResult] = await Promise.all([
    Payment.deleteMany({ user: user._id }),
    ManualPayment.deleteMany({ user: user._id }),
    LaunchReminder.deleteMany({ user: user._id }),
  ]);
  const userResult = await User.deleteOne({ _id: user._id });

  console.log("User deleted successfully");
  console.log(`  Email: ${normalizedEmail}`);
  console.log(`  User deleted: ${userResult.deletedCount}`);
  console.log(`  Payments deleted: ${paymentsResult.deletedCount}`);
  console.log(`  Manual payments deleted: ${manualResult.deletedCount}`);
  console.log(`  Launch reminders deleted: ${remindersResult.deletedCount}`);

  process.exit(0);
}

const email = process.argv.filter(a => a !== '--')[2];
if (!email || email.startsWith('-')) {
  console.error("Usage: pnpm delete:user <email>");
  process.exit(1);
}
deleteUser(email).catch((error) => {
  console.error("Error deleting user:", error);
  process.exit(1);
});
