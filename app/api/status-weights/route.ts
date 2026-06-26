import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { EVENT_STATUSES } from "@/lib/enums";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";
import { DEFAULT_STATUS_WEIGHTS } from "@/lib/otb";

// Returns the configured weight per status, filling defaults for any not yet set.
export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const rows = await prisma.statusWeight.findMany({ where: { organizationId: orgId } });
  const map = new Map(rows.map((r) => [r.status, r.weightPercent]));
  const weights = EVENT_STATUSES.map((status) => ({
    status,
    weightPercent: map.get(status) ?? DEFAULT_STATUS_WEIGHTS[status] ?? 100,
  }));
  return ok(weights);
});

const schema = z.object({
  status: z.enum(EVENT_STATUSES),
  weightPercent: z.coerce.number().int().min(0).max(100),
});

export const PUT = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const row = await prisma.statusWeight.upsert({
    where: { organizationId_status: { organizationId: orgId, status: body.status } },
    create: { organizationId: orgId, status: body.status, weightPercent: body.weightPercent },
    update: { weightPercent: body.weightPercent },
  });
  return ok(row);
});
