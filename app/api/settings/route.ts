import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

// Returns this org's settings as a key→value map.
export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const rows = await prisma.setting.findMany({ where: { organizationId: orgId } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return ok(map);
});

const schema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

// Upsert a single setting.
export const PUT = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { key, value } = await parseBody(req, schema);
  const row = await prisma.setting.upsert({
    where: { organizationId_key: { organizationId: orgId, key } },
    update: { value },
    create: { organizationId: orgId, key, value },
  });
  return ok(row);
});
