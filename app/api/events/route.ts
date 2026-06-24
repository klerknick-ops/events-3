import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, created, ok, parseBody, route } from "@/lib/api";
import { addDays, combineDateTime, endOfDay, parseYmd, startOfDay } from "@/lib/dates";
import { generateTasksFromTemplates } from "@/lib/task-gen";
import { requireOrg } from "@/lib/tenant";
import { ensureEventDays } from "@/lib/event-days";
import { logActivity } from "@/lib/activity";
import { fullEventInclude } from "@/lib/event-include";

// GET /api/events?date=YYYY-MM-DD       -> one day's slots (timeline)
//     /api/events?from=YYYY-MM-DD&to=…  -> a date range's slots (month calendar)
export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  const rangeStart = fromStr
    ? startOfDay(parseYmd(fromStr))
    : startOfDay(dateStr ? parseYmd(dateStr) : new Date());
  const rangeEnd = toStr
    ? endOfDay(parseYmd(toStr))
    : endOfDay(dateStr ? parseYmd(dateStr) : new Date());

  const slots = await prisma.eventTimeSlot.findMany({
    where: {
      event: { organizationId: orgId },
      startsAt: { lte: rangeEnd },
      endsAt: { gte: rangeStart },
    },
    orderBy: { startsAt: "asc" },
    include: {
      space: true,
      event: {
        select: {
          id: true,
          title: true,
          status: true,
          contact: {
            select: {
              firstName: true,
              lastName: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return ok({ date: dateStr ?? null, slots });
});

const prefillSchema = z.object({
  spaceId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  label: z.string().nullish(),
});

const createSchema = z.object({
  contactId: z.string().min(1, "A contact is required"),
  title: z.string().min(1, "A title is required"),
  templateId: z.string().nullish(),
  paymentTermsId: z.string().nullish(),
  baseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().nullish(),
  prefill: prefillSchema.nullish(),
});

export const POST = route(async (req) => {
  const { user, orgId } = await requireOrg();
  const body = await parseBody(req, createSchema);

  const contact = await prisma.contact.findFirst({
    where: { id: body.contactId, organizationId: orgId },
  });
  if (!contact) return badRequest("Contact not found");

  // Validate payment terms belong to this org.
  let paymentTermsId: string | null = null;
  if (body.paymentTermsId) {
    const pt = await prisma.paymentTerms.findFirst({
      where: { id: body.paymentTermsId, organizationId: orgId },
    });
    paymentTermsId = pt?.id ?? null;
  }

  const now = new Date();
  const baseDate = body.baseDate ? parseYmd(body.baseDate) : startOfDay(now);

  // Build slots: from a template, or from a single prefilled slot, else none.
  type SlotInput = {
    spaceId: string;
    label: string | null;
    startsAt: Date;
    endsAt: Date;
    sortOrder: number;
  };
  const slotInputs: SlotInput[] = [];
  let productInputs: { productId: string; quantity: number }[] = [];
  let generatedTasks: { title: string; assignee: string | null; dueDate: Date | null }[] = [];

  if (body.templateId) {
    const template = await prisma.eventTemplate.findFirst({
      where: { id: body.templateId, organizationId: orgId },
      include: {
        slots: { orderBy: { sortOrder: "asc" } },
        products: true,
        tasks: { include: { taskTemplate: true } },
      },
    });
    if (!template) return badRequest("Template not found");

    template.slots.forEach((s, i) => {
      if (!s.spaceId) return; // skip slots without a concrete space
      const day = addDays(baseDate, s.dayOffset);
      const startsAt = combineDateTime(
        `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
        s.startTime,
      );
      const endsAt = new Date(startsAt.getTime() + s.durationMin * 60000);
      slotInputs.push({
        spaceId: s.spaceId,
        label: s.label,
        startsAt,
        endsAt,
        sortOrder: i,
      });
    });

    productInputs = template.products.map((p) => ({
      productId: p.productId,
      quantity: p.quantity,
    }));

    const eventDate =
      slotInputs.length > 0
        ? slotInputs.reduce(
            (min, s) => (s.startsAt < min ? s.startsAt : min),
            slotInputs[0].startsAt,
          )
        : baseDate;
    generatedTasks = generateTasksFromTemplates(
      template.tasks.map((t) => t.taskTemplate),
      eventDate,
      now,
    );
  } else if (body.prefill) {
    slotInputs.push({
      spaceId: body.prefill.spaceId,
      label: body.prefill.label || null,
      startsAt: new Date(body.prefill.startsAt),
      endsAt: new Date(body.prefill.endsAt),
      sortOrder: 0,
    });
  }

  const event = await prisma.event.create({
    data: {
      organizationId: orgId,
      title: body.title,
      contactId: body.contactId,
      templateId: body.templateId || null,
      paymentTermsId,
      notes: body.notes || null,
      timeSlots: { create: slotInputs },
      products: { create: productInputs },
      tasks: { create: generatedTasks },
    },
  });

  // Build EventDay rows from the created slots (or a single day if custom/blank),
  // and link slots + products to their day.
  await ensureEventDays(event.id);
  await logActivity({
    eventId: event.id,
    userId: user.id,
    action: "EVENT_CREATED",
    summary: body.templateId
      ? "Created the event from a template"
      : "Created the event",
  });

  const full = await prisma.event.findUnique({
    where: { id: event.id },
    include: fullEventInclude,
  });
  return created(full);
});
