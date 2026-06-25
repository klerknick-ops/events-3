import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { getSignature } from "@/lib/mail/exclaimer";

// Resolve the current user's Exclaimer signature (best-effort) for the composer.
export const GET = route(async () => {
  const { user, orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  const sig = await getSignature({
    userName: user.name,
    userEmail: user.email,
    orgName: org?.name ?? "",
  });
  return ok(sig);
});
