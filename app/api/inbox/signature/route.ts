import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { renderSignatureHtml, STARTER_SIGNATURE, type SignatureBlock } from "@/lib/signature";

// Render the org's native email signature for the composer, substituting the
// CURRENT user's details (resolved per-request, so it's always the person
// composing — never whoever last edited the template).
export const GET = route(async () => {
  const { user, orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const [org, row] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: "email_signature" } },
    }),
  ]);

  let blocks: SignatureBlock[] = STARTER_SIGNATURE;
  if (row?.value) {
    try {
      blocks = JSON.parse(row.value) as SignatureBlock[];
    } catch {
      blocks = STARTER_SIGNATURE;
    }
  }

  const html = renderSignatureHtml(blocks, {
    user_name: user.name,
    user_email: user.email,
    org: org?.name ?? "",
  });

  return ok({ html, source: "native", note: `Signature added automatically for ${user.name}.` });
});
