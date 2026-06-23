import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, created, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";
import { ROLES } from "@/lib/permissions";

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export const GET = route(async () => {
  const { orgId } = await requireOrgPermission("MANAGE_USERS");
  const users = await prisma.user.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    select: publicSelect,
  });
  return ok(users);
});

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_USERS");
  const body = await parseBody(req, schema);
  const email = body.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return badRequest("A user with that email already exists");
  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      name: body.name.trim(),
      role: body.role,
      passwordHash: hashPassword(body.password),
    },
    select: publicSelect,
  });
  return created(user);
});
