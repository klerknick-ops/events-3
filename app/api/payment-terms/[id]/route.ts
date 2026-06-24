import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1).optional(),
  depositPercent: z.coerce.number().int().min(0).max(100).nullable().optional(),
  body: z.string().min(1).optional(),
  sortOrder: z.coerce.number().int().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.paymentTerms.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Payment terms not found");
  const body = await parseBody(req, schema);
  const term = await prisma.paymentTerms.update({ where: { id }, data: body });
  return ok(term);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.paymentTerms.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Payment terms not found");
  const inUse = await prisma.event.count({ where: { paymentTermsId: id } });
  if (inUse > 0) {
    const term = await prisma.paymentTerms.update({ where: { id }, data: { archived: true } });
    return ok({ archived: true, term });
  }
  await prisma.paymentTerms.delete({ where: { id } });
  return ok({ deleted: true });
});
