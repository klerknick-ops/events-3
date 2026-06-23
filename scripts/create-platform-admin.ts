import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

// Bootstrap a platform admin in production (idempotent upsert).
// Usage: PLATFORM_ADMIN_EMAIL=you@co.com PLATFORM_ADMIN_PASSWORD=secret \
//        PLATFORM_ADMIN_NAME="Owner" npm run create:platform-admin
const prisma = new PrismaClient();

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || "Platform Owner";
  if (!email || !password) {
    throw new Error(
      "Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD environment variables.",
    );
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true, active: true, name },
    create: {
      email,
      name,
      role: "ADMIN",
      isPlatformAdmin: true,
      passwordHash: hashPassword(password),
    },
  });
  console.log(`✅ Platform admin ready: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
