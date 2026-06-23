import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";
import { startOfDay, endOfDay, addDays } from "@/lib/dates";

// Aggregated data for the home dashboard: today's events, quick counts, and
// the tasks that need attention (overdue + due today). Scoped to the org.
export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  const [todaySlots, openTasks, roomsTonight] = await Promise.all([
    prisma.eventTimeSlot.findMany({
      where: {
        startsAt: { lte: todayEnd },
        endsAt: { gte: todayStart },
        event: { organizationId: orgId, status: { not: "CANCELLED" } },
      },
      orderBy: { startsAt: "asc" },
      include: {
        space: true,
        event: {
          include: { contact: { include: { company: true } } },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        completed: false,
        dueDate: { not: null },
        event: { organizationId: orgId },
      },
      orderBy: { dueDate: "asc" },
      include: {
        event: { select: { id: true, title: true } },
      },
    }),
    // Rooms occupied tonight: guests checked in by end of today and not
    // checking out until after today (i.e. sleeping here the night of today).
    prisma.eventRoomBooking.findMany({
      where: {
        checkIn: { lte: todayEnd },
        checkOut: { gt: todayEnd },
        event: { organizationId: orgId, status: { not: "CANCELLED" } },
      },
    }),
  ]);

  // Group today's slots into distinct events.
  const eventsMap = new Map<
    string,
    {
      id: string;
      title: string;
      status: string;
      client: string;
      company: string | null;
      spaces: string[];
      start: string;
      end: string;
    }
  >();
  for (const s of todaySlots) {
    const e = eventsMap.get(s.event.id);
    const spaceName = s.space.name;
    if (e) {
      if (!e.spaces.includes(spaceName)) e.spaces.push(spaceName);
      if (s.startsAt.toISOString() < e.start) e.start = s.startsAt.toISOString();
      if (s.endsAt.toISOString() > e.end) e.end = s.endsAt.toISOString();
    } else {
      eventsMap.set(s.event.id, {
        id: s.event.id,
        title: s.event.title,
        status: s.event.status,
        client: `${s.event.contact.firstName} ${s.event.contact.lastName}`,
        company: s.event.contact.company?.name ?? null,
        spaces: [spaceName],
        start: s.startsAt.toISOString(),
        end: s.endsAt.toISOString(),
      });
    }
  }
  const eventsToday = [...eventsMap.values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  const dueToday = openTasks.filter(
    (t) => t.dueDate! >= todayStart && t.dueDate! <= todayEnd,
  );
  const overdue = openTasks.filter((t) => t.dueDate! < todayStart);
  const dueThisWeek = openTasks.filter(
    (t) => t.dueDate! > todayEnd && t.dueDate! <= weekEnd,
  );

  // Attention list = overdue + due today (most urgent first).
  const attention = [...overdue, ...dueToday].map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    assignee: t.assignee,
    completed: t.completed,
    overdue: t.dueDate! < todayStart,
    event: t.event,
  }));

  return ok({
    eventsToday,
    counts: {
      eventsToday: eventsToday.length,
      tasksDueToday: dueToday.length,
      tasksOverdue: overdue.length,
      tasksThisWeek: dueThisWeek.length,
      roomsTonight: roomsTonight.reduce((sum, b) => sum + b.quantity, 0),
    },
    attention,
  });
});
