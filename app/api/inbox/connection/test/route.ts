import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { testConnection } from "@/lib/mail/graph";

// Verify the saved Microsoft 365 connection works against the mailbox.
export const POST = route(async () => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const result = await testConnection(orgId);
  return ok(result);
});
