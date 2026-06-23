import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, created, parseBody, route } from "@/lib/api";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  dayId: z.string().nullish(),
  slotId: z.string().nullish(),
  unitPriceNetOverride: z.coerce.number().min(0).nullish(),
  taxRateOverride: z.coerce.number().min(0).nullish(),
});

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const body = await parseBody(req, schema);

  // The product must belong to this org.
  const product = await prisma.product.findFirst({
    where: { id: body.productId, organizationId: orgId },
  });
  if (!product) return badRequest("Product not found");

  // If a slot is given but no day, inherit the slot's day.
  let dayId = body.dayId || null;
  if (!dayId && body.slotId) {
    const slot = await prisma.eventTimeSlot.findUnique({ where: { id: body.slotId } });
    dayId = slot?.dayId ?? null;
  }

  const ep = await prisma.eventProduct.create({
    data: {
      eventId: id,
      productId: body.productId,
      quantity: body.quantity,
      dayId,
      slotId: body.slotId || null,
      unitPriceNetOverride: body.unitPriceNetOverride ?? null,
      taxRateOverride: body.taxRateOverride ?? null,
    },
    include: { product: true, slot: true },
  });
  await logActivity({
    eventId: id,
    userId: user.id,
    action: "PRODUCT_ADDED",
    summary: `Added product “${ep.product.title}” ×${ep.quantity}`,
  });
  return created(ep);
});
