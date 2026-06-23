import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, created, ok, parseBody, route } from "@/lib/api";
import { requirePlatformAdmin } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";

export const GET = route(async () => {
  await requirePlatformAdmin();
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, events: true } },
    },
  });
  return ok(orgs);
});

const schema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens"),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
});

// Provision a new tenant: organization + its first Admin user.
export const POST = route(async (req) => {
  await requirePlatformAdmin();
  const body = await parseBody(req, schema);

  const slugTaken = await prisma.organization.findUnique({ where: { slug: body.slug } });
  if (slugTaken) return badRequest("That slug is already in use");
  const emailTaken = await prisma.user.findUnique({
    where: { email: body.adminEmail.toLowerCase().trim() },
  });
  if (emailTaken) return badRequest("That admin email is already in use");

  const org = await prisma.organization.create({
    data: {
      name: body.name,
      slug: body.slug,
      users: {
        create: {
          email: body.adminEmail.toLowerCase().trim(),
          name: body.adminName,
          role: "ADMIN",
          passwordHash: hashPassword(body.adminPassword),
        },
      },
    },
    include: { _count: { select: { users: true, events: true } } },
  });
  return created(org);
});
