import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { configuredMailbox, isGraphConfigured } from "@/lib/mail/graph";

// List synced emails (soft-deleted ones excluded).
//  ?view=client                 → Client Mail: auto-matched to a contact-with-event
//  ?view=leads&folder=inbox     → Leads & Vendors inbound (vendor/supplier/lead)
//  ?view=leads&folder=sent      → Leads & Vendors outbound (sent, incl. sent-to-lead)
// Gated to managers/admins (VIEW_GLOBAL_ACTIVITY) — the shared business mailbox.
export const GET = route(async (req) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "client";
  const folder = url.searchParams.get("folder") ?? "inbox";
  const showArchived = url.searchParams.get("archived") === "1";
  const q = url.searchParams.get("q")?.trim();

  const base = { organizationId: orgId, deletedAt: null };
  const where: Record<string, unknown> = {
    ...base,
    archivedAt: showArchived ? { not: null } : null,
  };
  if (view === "client") {
    where.autoMatched = true;
  } else {
    // Leads & Vendors
    if (folder === "sent") where.direction = "OUTBOUND";
    else {
      where.direction = "INBOUND";
      where.autoMatched = false;
    }
  }
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
      event: {
        select: {
          id: true,
          title: true,
          assignedUser: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, name: true } },
      attachments: { select: { id: true, filename: true, contentType: true, size: true, isInline: true } },
    },
    take: 200,
  });

  // Default views exclude archived; counts mirror that.
  const active = { ...base, archivedAt: null };
  const counts = {
    client: await prisma.emailMessage.count({ where: { ...active, autoMatched: true } }),
    leadsInbox: await prisma.emailMessage.count({
      where: { ...active, direction: "INBOUND", autoMatched: false },
    }),
    leadsSent: await prisma.emailMessage.count({ where: { ...active, direction: "OUTBOUND" } }),
    archived: await prisma.emailMessage.count({ where: { ...base, archivedAt: { not: null } } }),
  };

  return ok({
    configured: isGraphConfigured(),
    mailbox: configuredMailbox(),
    counts,
    messages,
  });
});
