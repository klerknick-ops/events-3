import { prisma } from "./db";
import { addDays } from "./dates";

export type TaskActionType = "EMAIL_RECEIVED" | "EMAIL_SENT" | "STATUS_CHANGE";

// Fire action-triggered Task Rules (Phase 6, Section 7). Called from the inbox
// sync/send hooks (email events) and the event status-change hook. Every
// generated task gets a deadline (now + the rule's leadDays) so the Phase 3
// required-deadline rule always holds.
export async function runActionRules(opts: {
  orgId: string;
  actionType: TaskActionType;
  status?: string | null; // for STATUS_CHANGE: the new status
  eventId?: string | null;
  emailMessageId?: string | null;
}): Promise<number> {
  const rules = await prisma.taskTemplate.findMany({
    where: {
      organizationId: opts.orgId,
      triggerType: "ACTION",
      actionType: opts.actionType,
    },
  });
  if (rules.length === 0) return 0;

  const now = new Date();
  const applicable = rules.filter((r) =>
    opts.actionType === "STATUS_CHANGE"
      ? !r.actionStatus || r.actionStatus === opts.status
      : true,
  );
  if (applicable.length === 0) return 0;

  await prisma.task.createMany({
    data: applicable.map((r) => ({
      organizationId: opts.orgId,
      eventId: opts.eventId ?? null,
      emailMessageId: opts.emailMessageId ?? null,
      title: r.title,
      assignedUserId: r.assignedUserId ?? null,
      dueDate: addDays(now, r.leadDays),
    })),
  });
  return applicable.length;
}
