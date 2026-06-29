/**
 * Set a user's subscription tier — for testing Pro/Pro+ gating locally.
 *
 * Usage: npm run set-tier -- <email> <free|pro|pro_plus>
 * Creates the user if they don't exist yet (handy before first WorkOS login).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VALID = ["free", "pro", "pro_plus"];

async function main() {
  const [email, tier] = process.argv.slice(2);
  if (!email || !VALID.includes(tier)) {
    console.error("Usage: npm run set-tier -- <email> <free|pro|pro_plus>");
    process.exit(1);
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: { subscriptionTier: tier },
    create: { email, subscriptionTier: tier },
  });
  console.log(`✓ ${user.email} -> ${user.subscriptionTier}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
