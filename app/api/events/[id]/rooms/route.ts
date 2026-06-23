import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, conflict, created, parseBody, route } from "@/lib/api";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { findRoomConflicts } from "@/lib/conflicts";
import { logActivity } from "@/lib/activity";
import { parseYmd } from "@/lib/dates";

const schema = z.object({
  roomTypeId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullish(),
  force: z.boolean().optional(),
});

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const body = await parseBody(req, schema);

  // Room type must belong to this org.
  const roomType = await prisma.hotelRoomType.findFirst({
    where: { id: body.roomTypeId, organizationId: orgId },
  });
  if (!roomType) return badRequest("Room type not found");

  const checkIn = parseYmd(body.checkIn);
  const checkOut = parseYmd(body.checkOut);
  if (!(checkIn < checkOut)) {
    return badRequest("Check-out must be after check-in");
  }

  if (!body.force) {
    const c = await findRoomConflicts({
      roomTypeId: body.roomTypeId,
      checkIn,
      checkOut,
      requested: body.quantity,
    });
    if (c.overbookedNights.length > 0) {
      return conflict("Not enough room inventory for these nights", c);
    }
  }

  const booking = await prisma.eventRoomBooking.create({
    data: {
      eventId: id,
      roomTypeId: body.roomTypeId,
      quantity: body.quantity,
      checkIn,
      checkOut,
      notes: body.notes || null,
    },
    include: { roomType: true },
  });
  await logActivity({
    eventId: id,
    userId: user.id,
    action: "ROOM_ADDED",
    summary: `Added ${booking.quantity}× ${booking.roomType.title}`,
  });
  return created(booking);
});
