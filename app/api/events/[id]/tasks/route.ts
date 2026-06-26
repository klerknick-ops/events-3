import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, parseBody, route } from "@/lib/api";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  title: z.string().min(1),
  assignee: z.string().nullish(), // legacy free-text
  assignedUserId: z.string().nullish(),
  // Manual tasks must have a deadline (Phase 3, Section 4).
  dueDate: z.string().min(1, "A deadline is required"),
});

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const body = await parseBody(req, schema);
  // Default the assignee to the creating user (Phase 6, Section 5).
  const assignedUserId = body.assignedUserId === undefined ? user.id : body.assignedUserId;
  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      eventId: id,
      title: body.title,
      assignee: body.assignee || null,
      assignedUserId: assignedUserId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
    include: { assignedUser: { select: { id: true, name: true } } },
  });
  await logActivity({
    eventId: id,
    organizationId: orgId,
    userId: user.id,
    action: "TASK_ADDED",
    summary: `Added task “${task.title}”`,
  });
  return created(task);
});
