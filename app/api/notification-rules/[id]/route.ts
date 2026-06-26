import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  message: z.string().min(1).optional(),
  minPersons: z.coerce.number().int().min(0).nullable().optional(),
  spaceIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.notificationRule.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Rule not found");
  const body = await parseBody(req, schema);

  if (body.spaceIds) {
    // Replace the applicable-space set.
    await prisma.notificationRuleSpace.deleteMany({ where: { ruleId: id } });
    await prisma.notificationRuleSpace.createMany({
      data: body.spaceIds.map((spaceId) => ({ ruleId: id, spaceId })),
    });
  }

  const rule = await prisma.notificationRule.update({
    where: { id },
    data: {
      message: body.message,
      minPersons: body.minPersons === undefined ? undefined : body.minPersons,
      active: body.active,
    },
    include: { spaces: { include: { space: { select: { id: true, name: true } } } } },
  });
  return ok(rule);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.notificationRule.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Rule not found");
  await prisma.notificationRule.delete({ where: { id } });
  return ok({ deleted: true });
});
