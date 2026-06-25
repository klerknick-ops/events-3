import { prisma } from "@/lib/db";
import { created, route } from "@/lib/api";
import { fullEventInclude } from "@/lib/event-include";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { ensureEventDays } from "@/lib/event-days";
import { logActivity } from "@/lib/activity";

// Duplicate an event with all slots, products, room bookings and tasks
// (status reset to Inquiry). Stays within the caller's organization.
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const src = await prisma.event.findUniqueOrThrow({
    where: { id },
    include: { timeSlots: true, products: true, tasks: true, roomBookings: true },
  });

  const copy = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        organizationId: orgId,
        title: `${src.title} (copy)`,
        status: "INQUIRY",
        notes: src.notes,
        contactId: src.contactId,
        templateId: src.templateId,
        tasks: {
          create: src.tasks.map((t) => ({
            organizationId: orgId,
            title: t.title,
            assignee: t.assignee,
            dueDate: t.dueDate,
            completed: false,
          })),
        },
        roomBookings: {
          create: src.roomBookings.map((b) => ({
            roomTypeId: b.roomTypeId,
            quantity: b.quantity,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            notes: b.notes,
          })),
        },
      },
    });

    // Recreate slots, keeping a map old->new so products keep their slot link.
    const slotMap = new Map<string, string>();
    for (const s of src.timeSlots) {
      const ns = await tx.eventTimeSlot.create({
        data: {
          eventId: event.id,
          spaceId: s.spaceId,
          label: s.label,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          sortOrder: s.sortOrder,
        },
      });
      slotMap.set(s.id, ns.id);
    }

    if (src.products.length) {
      await tx.eventProduct.createMany({
        data: src.products.map((p) => ({
          eventId: event.id,
          slotId: p.slotId ? slotMap.get(p.slotId) ?? null : null,
          productId: p.productId,
          quantity: p.quantity,
          unitPriceNetOverride: p.unitPriceNetOverride,
          taxRateOverride: p.taxRateOverride,
        })),
      });
    }

    return event;
  });

  await ensureEventDays(copy.id);
  await logActivity({
    eventId: copy.id,
    organizationId: orgId,
    userId: user.id,
    action: "EVENT_CREATED",
    summary: `Duplicated from “${src.title}”`,
  });

  const full = await prisma.event.findUnique({
    where: { id: copy.id },
    include: fullEventInclude,
  });
  return created(full);
});
