import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { TASK_DEADLINE_BASES } from "@/lib/enums";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().min(1).optional(),
  defaultAssignee: z.string().trim().nullable().optional(),
  offsetDays: z.coerce.number().int().min(0).optional(),
  basis: z.enum(TASK_DEADLINE_BASES).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.taskTemplate.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Task rule not found");
  const body = await parseBody(req, schema);
  const item = await prisma.taskTemplate.update({ where: { id }, data: body });
  return ok(item);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.taskTemplate.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Task rule not found");
  await prisma.taskTemplate.delete({ where: { id } });
  return ok({ deleted: true });
});
