import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";
import { MS_GRAPH_SETTING_KEY, getStoredConfig, connectionStatus } from "@/lib/mail/graph";

// Current Microsoft 365 connection (never returns the client secret).
export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const s = await getStoredConfig(orgId);
  const status = await connectionStatus(orgId);
  return ok({
    tenantId: s?.tenantId ?? "",
    clientId: s?.clientId ?? "",
    mailbox: s?.mailbox ?? "",
    hasSecret: Boolean(s?.clientSecret),
    consentedAt: s?.consentedAt ?? null,
    configured: status.configured,
    source: status.source,
  });
});

const schema = z.object({
  tenantId: z.string().trim().nullish(),
  clientId: z.string().trim().nullish(),
  clientSecret: z.string().nullish(), // blank = keep existing
  mailbox: z.string().trim().nullish(),
});

export const PUT = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const existing = (await getStoredConfig(orgId)) ?? {};

  // Changing tenant/client/secret invalidates any prior admin consent.
  const credsChanged =
    (body.tenantId ?? "") !== (existing.tenantId ?? "") ||
    (body.clientId ?? "") !== (existing.clientId ?? "") ||
    (body.clientSecret ? true : false);

  const merged = {
    tenantId: body.tenantId || existing.tenantId || "",
    clientId: body.clientId || existing.clientId || "",
    // Only overwrite the secret when a new one is supplied.
    clientSecret: body.clientSecret ? body.clientSecret : existing.clientSecret || "",
    mailbox: body.mailbox || existing.mailbox || "",
    consentedAt: credsChanged ? null : existing.consentedAt ?? null,
  };

  await prisma.setting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: MS_GRAPH_SETTING_KEY } },
    create: { organizationId: orgId, key: MS_GRAPH_SETTING_KEY, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return ok({ saved: true });
});
