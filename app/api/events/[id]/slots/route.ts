import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, conflict, created, parseBody, route } from "@/lib/api";
import { findSlotConflicts } from "@/lib/conflicts";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { ensureEventDays } from "@/lib/event-days";
import { computeSlotSetup } from "@/lib/slot-setup";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  spaceId: z.string().min(1),
  label: z.string().nullish(),
  startsAt: z.string(),
  endsAt: z.string(),
  personCount: z.coerce.number().int().min(0).optional(),
  setupId: z.string().nullish(),
  setupTableCount: z.coerce.number().int().min(0).nullish(),
  setupHeadTables: z.boolean().optional(),
  setupManual: z.boolean().optional(),
  notes: z.string().nullish(),
  force: z.boolean().optional(),
});

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const body = await parseBody(req, schema);
  // The space must belong to this org.
  const space = await prisma.bookableSpace.findFirst({
    where: { id: body.spaceId, organizationId: orgId },
  });
  if (!space) return badRequest("Space not found");
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!(startsAt < endsAt))
    return badRequest("End time must be after start time");

  if (!body.force) {
    const conflicts = await findSlotConflicts({
      spaceId: body.spaceId,
      startsAt,
      endsAt,
    });
    if (conflicts.length > 0) {
      return conflict("This space is already booked for an overlapping time", {
        conflicts,
      });
    }
  }

  const personCount = body.personCount ?? 0;
  const setupFields = await computeSlotSetup({
    spaceId: body.spaceId,
    personCount,
    setupId: body.setupId ?? null,
    manual: body.setupManual ?? false,
    tableCount: body.setupTableCount ?? null,
    headTables: body.setupHeadTables ?? false,
  });

  const count = await prisma.eventTimeSlot.count({ where: { eventId: id } });
  const slot = await prisma.eventTimeSlot.create({
    data: {
      eventId: id,
      spaceId: body.spaceId,
      label: body.label || null,
      startsAt,
      endsAt,
      sortOrder: count,
      personCount,
      notes: body.notes || null,
      ...setupFields,
    },
    include: { space: true },
  });
  // Ensure the slot's date has an EventDay and is linked to it.
  await ensureEventDays(id);
  await logActivity({
    eventId: id,
    userId: user.id,
    action: "SLOT_ADDED",
    summary: `Added time slot${slot.label ? ` “${slot.label}”` : ""} in ${slot.space.name}`,
  });
  return created(slot);
});
