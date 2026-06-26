import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().min(1).optional(),
  assignee: z.string().nullish(),
  assignedUserId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  // Org-scoped (a task may have no event — e.g. a lead follow-up).
  const owned = await prisma.task.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!owned) return notFound("Task not found");
  const body = await parseBody(req, schema);
  const task = await prisma.task.update({
    where: { id },
    data: {
      title: body.title,
      assignee: body.assignee === undefined ? undefined : body.assignee,
      assignedUserId: body.assignedUserId === undefined ? undefined : body.assignedUserId,
      dueDate:
        body.dueDate === undefined
          ? undefined
          : body.dueDate
            ? new Date(body.dueDate)
            : null,
      completed: body.completed,
    },
    include: { assignedUser: { select: { id: true, name: true } } },
  });
  if (body.completed === true && !owned.completed) {
    await logActivity({
      eventId: task.eventId,
      organizationId: orgId,
      userId: user.id,
      action: "TASK_COMPLETED",
      summary: `Completed task “${task.title}”`,
    });
  }
  return ok(task);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const owned = await prisma.task.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!owned) return notFound("Task not found");
  await prisma.task.delete({ where: { id } });
  return ok({ deleted: true });
});
