import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { configuredMailbox, isGraphConfigured } from "@/lib/mail/graph";

// List synced emails. ?view=client|leads|all, optional ?q= search.
//  - client: auto-matched to a contact-with-event (Client Mail)
//  - leads:  everything else — vendor/supplier/lead mail (stays here even after
//            being manually linked to an event) plus outbound composed mail.
// Gated to managers/admins (VIEW_GLOBAL_ACTIVITY) — the shared business mailbox.
export const GET = route(async (req) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "all";
  const q = url.searchParams.get("q")?.trim();

  const where: Record<string, unknown> = { organizationId: orgId };
  if (view === "client") where.autoMatched = true;
  else if (view === "leads") where.autoMatched = false;
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { fromAddress: { contains: q, mode: "insensitive" } },
      { fromName: { contains: q, mode: "insensitive" } },
    ];
  }

  const messages = await prisma.emailMessage.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      event: { select: { id: true, title: true } },
    },
    take: 200,
  });

  const counts = {
    client: await prisma.emailMessage.count({ where: { organizationId: orgId, autoMatched: true } }),
    leads: await prisma.emailMessage.count({ where: { organizationId: orgId, autoMatched: false } }),
  };

  return ok({
    configured: isGraphConfigured(),
    mailbox: configuredMailbox(),
    counts,
    messages,
  });
});
