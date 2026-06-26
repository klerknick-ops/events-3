import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

// Return the warning messages for rules matching the planner's current selection
// (space / setup / product + person count). Non-blocking — the UI surfaces these
// as amber suggestions, consistent with Phase 3's setup auto-rules.
export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId") || null;
  const setupId = url.searchParams.get("setupId") || null;
  const productId = url.searchParams.get("productId") || null;
  const personsRaw = url.searchParams.get("persons");
  const persons = personsRaw != null ? Number(personsRaw) : null;

  const rules = await prisma.notificationRule.findMany({
    where: { organizationId: orgId, active: true },
    include: { spaces: { select: { spaceId: true } } },
  });

  const messages: string[] = [];
  for (const r of rules) {
    if (r.minPersons != null && !(persons != null && persons >= r.minPersons)) continue;
    const ruleSpaceIds = r.spaces.map((s) => s.spaceId);
    const spaceOk = ruleSpaceIds.length === 0 || (spaceId != null && ruleSpaceIds.includes(spaceId));

    if (r.targetType === "SPACE") {
      if (spaceId && ruleSpaceIds.includes(spaceId)) messages.push(r.message);
    } else if (r.targetType === "SETUP") {
      if (setupId && r.setupId === setupId && spaceOk) messages.push(r.message);
    } else if (r.targetType === "PRODUCT") {
      if (productId && r.productId === productId && spaceOk) messages.push(r.message);
    }
  }

  return ok({ messages });
});
