import { prisma } from "@/lib/db";
import { notFound, ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

// All emails linked to a contact: directly (contactId) or via their events.
// Gated to VIEW_GLOBAL_ACTIVITY, consistent with the main Inbox.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!contact) return notFound("Contact not found");

  const messages = await prisma.emailMessage.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      OR: [{ contactId: id }, { event: { contactId: id } }],
    },
    orderBy: { receivedAt: "desc" },
    include: {
      event: { select: { id: true, title: true } },
      attachments: { select: { id: true, filename: true, contentType: true, size: true, isInline: true } },
    },
    take: 200,
  });
  return ok(messages);
});
