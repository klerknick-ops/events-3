import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";
import { findRoomConflicts } from "@/lib/conflicts";
import { logActivity } from "@/lib/activity";
import { parseYmd } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().nullish(),
  force: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const existing = await prisma.eventRoomBooking.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!existing) return notFound("Booking not found");

  const quantity = body.quantity ?? existing.quantity;
  const checkIn = body.checkIn ? parseYmd(body.checkIn) : existing.checkIn;
  const checkOut = body.checkOut ? parseYmd(body.checkOut) : existing.checkOut;
  if (!(checkIn < checkOut)) return badRequest("Check-out must be after check-in");

  if (!body.force) {
    const c = await findRoomConflicts({
      roomTypeId: existing.roomTypeId,
      checkIn,
      checkOut,
      requested: quantity,
      excludeBookingId: id,
    });
    if (c.overbookedNights.length > 0) {
      return conflict("Not enough room inventory for these nights", c);
    }
  }

  const booking = await prisma.eventRoomBooking.update({
    where: { id },
    data: {
      quantity,
      checkIn,
      checkOut,
      notes: body.notes === undefined ? undefined : body.notes,
    },
    include: { roomType: true },
  });
  return ok(booking);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const existing = await prisma.eventRoomBooking.findFirst({
    where: { id, event: { organizationId: orgId } },
    include: { roomType: true },
  });
  if (!existing) return notFound("Booking not found");
  await prisma.eventRoomBooking.delete({ where: { id } });
  await logActivity({
    eventId: existing.eventId,
    userId: user.id,
    action: "ROOM_REMOVED",
    summary: `Removed ${existing.quantity}× ${existing.roomType.title}`,
  });
  return ok({ deleted: true });
});
