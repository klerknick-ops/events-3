import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

// Lightweight active-user list (id + name) for owner / assignee dropdowns.
// Gated to VIEW_GLOBAL_ACTIVITY (managers/admins) so inbox staff can assign
// owners without the broader MANAGE_USERS permission.
export const GET = route(async () => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const users = await prisma.user.findMany({
    where: { organizationId: orgId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return ok(users);
});
