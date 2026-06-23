import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const notes = await prisma.eventNote.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });
  return ok(notes);
});

const schema = z.object({ body: z.string().min(1) });

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const { body } = await parseBody(req, schema);
  const note = await prisma.eventNote.create({
    data: { eventId: id, authorId: user.id, body },
    include: { author: { select: { id: true, name: true } } },
  });
  await logActivity({
    eventId: id,
    organizationId: orgId,
    userId: user.id,
    action: "NOTE_ADDED",
    summary: "Added a note",
  });
  return created(note);
});
