import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

// Org-wide activity log (admin/manager-facing). Filter by user and date range.
export const GET = route(async (req) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const createdAt =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
        }
      : undefined;

  const entries = await prisma.activityLog.findMany({
    where: { organizationId: orgId, userId, createdAt },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      user: { select: { id: true, name: true } },
      event: { select: { id: true, title: true } },
    },
  });
  return ok(entries);
});
