import { prisma } from "@/lib/db";
import { notFound, ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

// All emails linked to any of a company's contacts: directly (contact.companyId)
// or via those contacts' events. Gated to VIEW_GLOBAL_ACTIVITY.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const { id } = await ctx.params;
  const company = await prisma.company.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!company) return notFound("Company not found");

  const messages = await prisma.emailMessage.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      OR: [{ contact: { companyId: id } }, { event: { contact: { companyId: id } } }],
    },
    orderBy: { receivedAt: "desc" },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      event: { select: { id: true, title: true } },
      attachments: { select: { id: true, filename: true, contentType: true, size: true, isInline: true } },
    },
    take: 200,
  });
  return ok(messages);
});
