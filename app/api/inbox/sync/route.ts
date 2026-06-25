import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { syncMailbox } from "@/lib/mail/sync";

// Pull new mail from the connected mailbox (or seed the demo set in dev).
export const POST = route(async () => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const result = await syncMailbox(orgId);
  return ok(result);
});
