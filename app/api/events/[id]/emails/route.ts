import { prisma } from "@/lib/db";
import { notFound, ok, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

// Emails tied to an event (auto-matched client mail + manually-linked
// vendor/lead mail) for the event's Inbox tab.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const event = await prisma.event.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!event) return notFound("Event not found");

  const messages = await prisma.emailMessage.findMany({
    where: { organizationId: orgId, eventId: id },
    orderBy: { receivedAt: "desc" },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(messages);
});
