import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { TASK_DEADLINE_BASES } from "@/lib/enums";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const items = await prisma.taskTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: { title: "asc" },
  });
  return ok(items);
});

const schema = z.object({
  title: z.string().min(1),
  assignedUserId: z.string().nullish(),
  triggerType: z.enum(["RELATIVE", "RECURRING", "ACTION"]).default("RELATIVE"),
  offsetDays: z.coerce.number().int().min(0).default(0),
  basis: z.enum(TASK_DEADLINE_BASES).default("BEFORE_EVENT"),
  recurrenceFreq: z.enum(["WEEKLY", "MONTHLY"]).nullish(),
  recurrenceWeekday: z.coerce.number().int().min(0).max(6).nullish(),
  recurrenceDay: z.coerce.number().int().min(1).max(31).nullish(),
  recurrenceOrdinal: z.coerce.number().int().min(-1).max(5).nullish(),
  actionType: z.enum(["EMAIL_RECEIVED", "EMAIL_SENT", "STATUS_CHANGE"]).nullish(),
  actionStatus: z.string().nullish(),
  leadDays: z.coerce.number().int().min(0).default(7),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const item = await prisma.taskTemplate.create({
    data: {
      organizationId: orgId,
      title: body.title,
      assignedUserId: body.assignedUserId || null,
      triggerType: body.triggerType,
      offsetDays: body.offsetDays,
      basis: body.basis,
      recurrenceFreq: body.recurrenceFreq ?? null,
      recurrenceWeekday: body.recurrenceWeekday ?? null,
      recurrenceDay: body.recurrenceDay ?? null,
      recurrenceOrdinal: body.recurrenceOrdinal ?? null,
      actionType: body.actionType ?? null,
      actionStatus: body.actionStatus || null,
      leadDays: body.leadDays,
    },
  });
  return created(item);
});
