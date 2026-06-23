import { prisma } from "./db";
import { ymd } from "./dates";

export interface SlotConflict {
  slotId: string;
  eventId: string;
  eventTitle: string;
  label: string | null;
  startsAt: string;
  endsAt: string;
}

// Find overlapping booked slots in the same space. Cancelled events are ignored
// (their space is effectively free). `excludeSlotId` skips the slot being edited.
export async function findSlotConflicts(params: {
  spaceId: string;
  startsAt: Date;
  endsAt: Date;
  excludeSlotId?: string;
}): Promise<SlotConflict[]> {
  const { spaceId, startsAt, endsAt, excludeSlotId } = params;

  const overlapping = await prisma.eventTimeSlot.findMany({
    where: {
      spaceId,
      id: excludeSlotId ? { not: excludeSlotId } : undefined,
      // Overlap test: existing.start < new.end AND existing.end > new.start
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      event: { status: { not: "CANCELLED" } },
    },
    include: { event: { select: { id: true, title: true } } },
    orderBy: { startsAt: "asc" },
  });

  return overlapping.map((s) => ({
    slotId: s.id,
    eventId: s.event.id,
    eventTitle: s.event.title,
    label: s.label,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
  }));
}

export interface RoomConflict {
  inventory: number;
  requested: number;
  // Nights where existing demand + requested exceeds inventory.
  overbookedNights: { date: string; alreadyBooked: number }[];
}

// Enumerate nights (YYYY-MM-DD) occupied by a [checkIn, checkOut) stay.
function nightsBetween(checkIn: Date, checkOut: Date): string[] {
  const nights: string[] = [];
  const d = new Date(checkIn);
  d.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    nights.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return nights;
}

// Per-night inventory check for a room type. Mirrors the space-conflict pattern:
// returns the nights where booking `requested` more rooms would exceed the
// type's inventory (existing non-cancelled bookings counted per night).
export async function findRoomConflicts(params: {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  requested: number;
  excludeBookingId?: string;
}): Promise<RoomConflict> {
  const { roomTypeId, checkIn, checkOut, requested, excludeBookingId } = params;

  const roomType = await prisma.hotelRoomType.findUnique({
    where: { id: roomTypeId },
  });
  const inventory = roomType?.inventory ?? 0;

  const overlapping = await prisma.eventRoomBooking.findMany({
    where: {
      roomTypeId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      event: { status: { not: "CANCELLED" } },
    },
  });

  // Tally how many rooms are already booked per night.
  const perNight = new Map<string, number>();
  for (const b of overlapping) {
    for (const n of nightsBetween(b.checkIn, b.checkOut)) {
      perNight.set(n, (perNight.get(n) ?? 0) + b.quantity);
    }
  }

  const overbookedNights: { date: string; alreadyBooked: number }[] = [];
  for (const n of nightsBetween(checkIn, checkOut)) {
    const already = perNight.get(n) ?? 0;
    if (already + requested > inventory) {
      overbookedNights.push({ date: n, alreadyBooked: already });
    }
  }

  return { inventory, requested, overbookedNights };
}
