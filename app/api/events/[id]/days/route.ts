import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, parseBody, route } from "@/lib/api";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { copyDay } from "@/lib/event-days";
import { logActivity } from "@/lib/activity";
import { parseYmd, formatDateLong } from "@/lib/dates";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().nullish(),
  copyFromDayId: z.string().nullish(),
});

// Add a day to an event — either blank or copied from an existing day.
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const body = await parseBody(req, schema);

  let dayId: string;
  if (body.copyFromDayId) {
    dayId = await copyDay(id, body.copyFromDayId, body.date);
  } else {
    const count = await prisma.eventDay.count({ where: { eventId: id } });
    const day = await prisma.eventDay.create({
      data: {
        eventId: id,
        date: parseYmd(body.date),
        label: body.label || null,
        sortOrder: count,
      },
    });
    dayId = day.id;
  }

  await logActivity({
    eventId: id,
    userId: user.id,
    action: "DAY_ADDED",
    summary: body.copyFromDayId
      ? `Copied a day onto ${formatDateLong(parseYmd(body.date))}`
      : `Added a day on ${formatDateLong(parseYmd(body.date))}`,
  });

  const day = await prisma.eventDay.findUnique({
    where: { id: dayId },
    include: { timeSlots: { include: { space: true } } },
  });
  return created(day);
});
