import { prisma } from "./db";
import { ymd, parseYmd } from "./dates";

// Derive/repair EventDay rows for an event from its slots, and link slots +
// products to the correct day. Idempotent — safe to call after any mutation
// that changes slot dates. Also used to backfill legacy single-day events.
export async function ensureEventDays(eventId: string): Promise<void> {
  const [slots, products, ev] = await Promise.all([
    prisma.eventTimeSlot.findMany({ where: { eventId }, orderBy: { startsAt: "asc" } }),
    prisma.eventProduct.findMany({ where: { eventId } }),
    prisma.event.findUnique({ where: { id: eventId } }),
  ]);

  const existingDays = await prisma.eventDay.findMany({ where: { eventId } });
  const dayByDate = new Map<string, string>();
  for (const d of existingDays) dayByDate.set(ymd(d.date), d.id);

  // Every distinct slot date needs a day.
  const dates = new Set<string>(slots.map((s) => ymd(s.startsAt)));
  // Keep existing (possibly empty) days too.
  for (const d of existingDays) dates.add(ymd(d.date));
  // An event with nothing yet still gets one day to work in.
  if (dates.size === 0) dates.add(ymd(ev?.createdAt ?? new Date()));

  for (const dstr of dates) {
    if (!dayByDate.has(dstr)) {
      const created = await prisma.eventDay.create({
        data: { eventId, date: parseYmd(dstr) },
      });
      dayByDate.set(dstr, created.id);
    }
  }

  // Normalize sortOrder by date.
  const allDays = await prisma.eventDay.findMany({
    where: { eventId },
    orderBy: { date: "asc" },
  });
  await Promise.all(
    allDays.map((d, i) =>
      d.sortOrder === i
        ? Promise.resolve()
        : prisma.eventDay.update({ where: { id: d.id }, data: { sortOrder: i } }),
    ),
  );

  // Link slots to their day.
  const slotDay = new Map<string, string>();
  for (const s of slots) {
    const dayId = dayByDate.get(ymd(s.startsAt));
    if (dayId) {
      slotDay.set(s.id, dayId);
      if (s.dayId !== dayId) {
        await prisma.eventTimeSlot.update({ where: { id: s.id }, data: { dayId } });
      }
    }
  }

  // Link products: slot-scoped → slot's day; otherwise keep or fall back to the
  // earliest day so legacy event-level products remain visible.
  const earliest = allDays[0]?.id ?? null;
  for (const p of products) {
    let dayId = p.dayId;
    if (p.slotId) dayId = slotDay.get(p.slotId) ?? dayId;
    if (!dayId) dayId = earliest;
    if (dayId && dayId !== p.dayId) {
      await prisma.eventProduct.update({ where: { id: p.id }, data: { dayId } });
    }
  }
}

// Copy a day's slots + products onto a new date, returning the new day id.
export async function copyDay(
  eventId: string,
  sourceDayId: string,
  targetDateStr: string,
): Promise<string> {
  const source = await prisma.eventDay.findUnique({
    where: { id: sourceDayId },
    include: { timeSlots: true, products: true },
  });
  if (!source) throw new Error("Source day not found");

  const targetDate = parseYmd(targetDateStr);
  const dayCount = await prisma.eventDay.count({ where: { eventId } });

  return prisma.$transaction(async (tx) => {
    const newDay = await tx.eventDay.create({
      data: {
        eventId,
        date: targetDate,
        label: source.label,
        sortOrder: dayCount,
      },
    });

    // Shift each slot's date to the target day, preserving time-of-day.
    const slotIdMap = new Map<string, string>();
    for (const s of source.timeSlots) {
      const ns = await tx.eventTimeSlot.create({
        data: {
          eventId,
          dayId: newDay.id,
          spaceId: s.spaceId,
          label: s.label,
          startsAt: shiftToDate(s.startsAt, targetDate),
          endsAt: shiftToDate(s.endsAt, targetDate),
          sortOrder: s.sortOrder,
        },
      });
      slotIdMap.set(s.id, ns.id);
    }

    for (const p of source.products) {
      await tx.eventProduct.create({
        data: {
          eventId,
          dayId: newDay.id,
          slotId: p.slotId ? slotIdMap.get(p.slotId) ?? null : null,
          productId: p.productId,
          quantity: p.quantity,
          unitPriceNetOverride: p.unitPriceNetOverride,
          taxRateOverride: p.taxRateOverride,
        },
      });
    }

    return newDay.id;
  });
}

// Replace the date portion of `src` with `target`, keeping hours/minutes.
function shiftToDate(src: Date, target: Date): Date {
  const d = new Date(target);
  d.setHours(src.getHours(), src.getMinutes(), 0, 0);
  return d;
}
