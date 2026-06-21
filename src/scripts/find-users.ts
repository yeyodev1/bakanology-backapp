import "dotenv/config";
import { dbConnect } from "../config/mongo";
import { User } from "../models/User";

async function findUsers() {
  await dbConnect();

  const search = process.argv[2];
  if (!search) {
    console.log(
      "Usage: pnpm exec ts-node src/scripts/find-users.ts <search-term>",
    );
    process.exit(1);
  }

  const regex = new RegExp(search, "i");
  const users = await User.find({
    $or: [{ email: regex }, { name: regex }, { lastName: regex }],
  }).select("name lastName email isVerified subscriptionStatus createdAt");

  console.log(`Found ${users.length} user(s) matching "${search}":`);
  users.forEach((user) => {
    console.log(`  - ${user.name} ${user.lastName} <${user.email}>`);
    console.log(
      `    verified: ${user.isVerified}, subscription: ${user.subscriptionStatus}, createdAt: ${user.createdAt}`,
    );
  });

  process.exit(0);
}

findUsers().catch((error) => {
  console.error("Error finding users:", error);
  process.exit(1);
});
