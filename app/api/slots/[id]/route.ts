import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound, ok, parseBody, route } from "@/lib/api";
import { findSlotConflicts } from "@/lib/conflicts";
import { requireOrg } from "@/lib/tenant";
import { ensureEventDays } from "@/lib/event-days";
import { logActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  spaceId: z.string().optional(),
  label: z.string().nullish(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  force: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const existing = await prisma.eventTimeSlot.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!existing) return notFound("Slot not found");

  if (body.spaceId) {
    const space = await prisma.bookableSpace.findFirst({
      where: { id: body.spaceId, organizationId: orgId },
    });
    if (!space) return badRequest("Space not found");
  }

  const spaceId = body.spaceId ?? existing.spaceId;
  const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
  const endsAt = body.endsAt ? new Date(body.endsAt) : existing.endsAt;
  if (!(startsAt < endsAt)) return badRequest("End time must be after start time");

  if (!body.force) {
    const conflicts = await findSlotConflicts({
      spaceId,
      startsAt,
      endsAt,
      excludeSlotId: id,
    });
    if (conflicts.length > 0) {
      return conflict("This space is already booked for an overlapping time", {
        conflicts,
      });
    }
  }

  const slot = await prisma.eventTimeSlot.update({
    where: { id },
    data: {
      spaceId,
      label: body.label === undefined ? undefined : body.label,
      startsAt,
      endsAt,
    },
    include: { space: true },
  });
  // Re-link in case the date moved to a different / new day.
  await ensureEventDays(existing.eventId);
  await logActivity({
    eventId: existing.eventId,
    userId: user.id,
    action: "SLOT_EDITED",
    summary: `Edited time slot${slot.label ? ` “${slot.label}”` : ""}`,
  });
  return ok(slot);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const existing = await prisma.eventTimeSlot.findFirst({
    where: { id, event: { organizationId: orgId } },
    include: { space: true },
  });
  if (!existing) return notFound("Slot not found");
  await prisma.eventTimeSlot.delete({ where: { id } });
  await logActivity({
    eventId: existing.eventId,
    userId: user.id,
    action: "SLOT_REMOVED",
    summary: `Removed time slot${existing.label ? ` “${existing.label}”` : ""} in ${existing.space.name}`,
  });
  return ok({ deleted: true });
});
