import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  dayId: z.string().nullable().optional(),
  slotId: z.string().nullable().optional(),
  unitPriceNetOverride: z.coerce.number().min(0).nullable().optional(),
  taxRateOverride: z.coerce.number().min(0).nullable().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const owned = await prisma.eventProduct.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!owned) return notFound("Line not found");
  const body = await parseBody(req, schema);
  const ep = await prisma.eventProduct.update({
    where: { id },
    data: body,
    include: { product: true, slot: true },
  });
  return ok(ep);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const existing = await prisma.eventProduct.findFirst({
    where: { id, event: { organizationId: orgId } },
    include: { product: true },
  });
  if (!existing) return notFound("Line not found");
  await prisma.eventProduct.delete({ where: { id } });
  await logActivity({
    eventId: existing.eventId,
    organizationId: orgId,
    userId: user.id,
    action: "PRODUCT_REMOVED",
    summary: `Removed product “${existing.product.title}”`,
  });
  return ok({ deleted: true });
});
