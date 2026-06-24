import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { computeEventTotals, computeRoomTotals } from "@/lib/event-helpers";
import { ymd } from "@/lib/dates";
import { round2 } from "@/lib/money";

// Reporting data for a given month: event counts, revenue by day/week/month,
// and revenue split by status. Gated to managers/admins.
export const GET = route(async (req) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // YYYY-MM
  const now = new Date();
  const [y, m] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  const trendStart = new Date(y, m - 6, 1, 0, 0, 0, 0); // 6-month trailing window

  const events = await prisma.event.findMany({
    where: {
      organizationId: orgId,
      timeSlots: { some: { startsAt: { gte: trendStart, lte: monthEnd } } },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      timeSlots: { select: { startsAt: true } },
      products: { include: { product: true } },
      roomBookings: { include: { roomType: true } },
    },
  });

  function grossOf(ev: (typeof events)[number]): number {
    const products = computeEventTotals(ev.products).totals.gross;
    const rooms = computeRoomTotals(ev.roomBookings).totals.gross;
    return round2(products + rooms);
  }
  function primaryDate(ev: (typeof events)[number]): Date {
    if (ev.timeSlots.length === 0) return ev.createdAt;
    return ev.timeSlots.reduce(
      (min, s) => (s.startsAt < min ? s.startsAt : min),
      ev.timeSlots[0].startsAt,
    );
  }
  function weekStartYmd(d: Date): string {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
    return ymd(x);
  }

  // ----- Selected month aggregations -----
  const inMonth = events.filter((e) => {
    const d = primaryDate(e);
    return d >= monthStart && d <= monthEnd;
  });

  const byStatus: Record<string, number> = {};
  const byDay = new Map<string, number>();
  const byWeek = new Map<string, number>();
  let total = 0;
  for (const e of inMonth) {
    const g = grossOf(e);
    byStatus[e.status] = round2((byStatus[e.status] ?? 0) + g);
    if (e.status !== "CANCELLED") {
      total = round2(total + g);
      const d = primaryDate(e);
      const dk = ymd(d);
      byDay.set(dk, round2((byDay.get(dk) ?? 0) + g));
      const wk = weekStartYmd(d);
      byWeek.set(wk, round2((byWeek.get(wk) ?? 0) + g));
    }
  }

  // ----- 6-month trend -----
  const trend: { month: string; events: number; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const md = new Date(y, m - 1 - i, 1);
    const key = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}`;
    const ms = new Date(md.getFullYear(), md.getMonth(), 1, 0, 0, 0, 0);
    const me = new Date(md.getFullYear(), md.getMonth() + 1, 0, 23, 59, 59, 999);
    const evs = events.filter((e) => {
      const d = primaryDate(e);
      return d >= ms && d <= me;
    });
    const revenue = round2(
      evs.filter((e) => e.status !== "CANCELLED").reduce((sum, e) => sum + grossOf(e), 0),
    );
    trend.push({ month: key, events: evs.length, revenue });
  }

  return ok({
    month: `${y}-${String(m).padStart(2, "0")}`,
    eventsInMonth: inMonth.length,
    total,
    byStatus,
    byDay: [...byDay.entries()].sort().map(([date, gross]) => ({ date, gross })),
    byWeek: [...byWeek.entries()].sort().map(([weekStart, gross]) => ({ weekStart, gross })),
    trend,
  });
});
