import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route, forbidden } from "@/lib/api";
import { fullEventInclude } from "@/lib/event-include";
import { EVENT_STATUSES } from "@/lib/enums";
import { can } from "@/lib/permissions";
import { requireOrg, getEventInOrg } from "@/lib/tenant";
import { logActivity, diffEventChanges } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const event = await prisma.event.findFirst({
    where: { id, organizationId: orgId },
    include: fullEventInclude,
  });
  if (!event) return notFound("Event not found");
  return ok(event);
});

const schema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  notes: z.string().nullish(),
  contactId: z.string().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);

  // Cancelling an event is permission-gated.
  if (body.status === "CANCELLED" && !can(user.role, "CANCEL_EVENT")) {
    return forbidden("You don't have permission to cancel events");
  }

  const before = await getEventInOrg(id, orgId);

  // If reassigning the contact, it must be in the same org.
  if (body.contactId) {
    const c = await prisma.contact.findFirst({
      where: { id: body.contactId, organizationId: orgId },
    });
    if (!c) return notFound("Contact not found");
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      title: body.title,
      status: body.status,
      notes: body.notes ?? undefined,
      contactId: body.contactId,
    },
    include: fullEventInclude,
  });

  for (const entry of diffEventChanges(before, event)) {
    await logActivity({ eventId: id, organizationId: orgId, userId: user.id, ...entry });
  }

  return ok(event);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user, orgId } = await requireOrg();
  if (!can(user.role, "DELETE_EVENT")) {
    return forbidden("You don't have permission to delete events");
  }
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  await prisma.event.delete({ where: { id } });
  return ok({ deleted: true });
});

