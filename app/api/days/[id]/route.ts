import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";
import { ensureEventDays } from "@/lib/event-days";
import { logActivity } from "@/lib/activity";
import { parseYmd } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label: z.string().nullish(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const day = await prisma.eventDay.findFirst({
    where: { id, event: { organizationId: orgId } },
    include: { timeSlots: true },
  });
  if (!day) return notFound("Day not found");

  // If the date changed, shift this day's slots to the new date (keep times).
  if (body.date) {
    const target = parseYmd(body.date);
    for (const s of day.timeSlots) {
      await prisma.eventTimeSlot.update({
        where: { id: s.id },
        data: {
          startsAt: withDate(s.startsAt, target),
          endsAt: withDate(s.endsAt, target),
        },
      });
    }
  }

  await prisma.eventDay.update({
    where: { id },
    data: {
      date: body.date ? parseYmd(body.date) : undefined,
      label: body.label === undefined ? undefined : body.label,
    },
  });
  await ensureEventDays(day.eventId);
  return ok({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const day = await prisma.eventDay.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!day) return notFound("Day not found");

  const count = await prisma.eventDay.count({ where: { eventId: day.eventId } });
  if (count <= 1) {
    return badRequest("An event must keep at least one day");
  }

  // Cascade removes the day's slots + products.
  await prisma.eventDay.delete({ where: { id } });
  await ensureEventDays(day.eventId);
  await logActivity({
    eventId: day.eventId,
    userId: user.id,
    action: "DAY_REMOVED",
    summary: "Removed a day from the event",
  });
  return ok({ deleted: true });
});

function withDate(src: Date, target: Date): Date {
  const d = new Date(target);
  d.setHours(src.getHours(), src.getMinutes(), 0, 0);
  return d;
}
