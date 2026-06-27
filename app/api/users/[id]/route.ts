import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, route } from "@/lib/api";
import { parseBody } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";
import { ROLES } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  title: true,
  phone: true,
  active: true,
  createdAt: true,
} as const;

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  title: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { user: actor, orgId } = await requireOrgPermission("MANAGE_USERS");
  const { id } = await ctx.params;
  const target = await prisma.user.findFirst({ where: { id, organizationId: orgId } });
  if (!target) return notFound("User not found");
  const body = await parseBody(req, schema);

  // Guard against an admin locking themselves out.
  if (actor.id === id && (body.role && body.role !== "ADMIN")) {
    return badRequest("You can't change your own role away from Admin");
  }
  if (actor.id === id && body.active === false) {
    return badRequest("You can't deactivate your own account");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role,
      title: body.title === undefined ? undefined : body.title || null,
      phone: body.phone === undefined ? undefined : body.phone || null,
      active: body.active,
      passwordHash: body.password ? hashPassword(body.password) : undefined,
    },
    select: publicSelect,
  });
  return ok(user);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user: actor, orgId } = await requireOrgPermission("MANAGE_USERS");
  const { id } = await ctx.params;
  if (actor.id === id) return badRequest("You can't delete your own account");
  const target = await prisma.user.findFirst({ where: { id, organizationId: orgId } });
  if (!target) return notFound("User not found");
  // Deactivate rather than hard-delete to preserve activity/note authorship.
  await prisma.user.update({ where: { id }, data: { active: false } });
  return ok({ deactivated: true });
});
