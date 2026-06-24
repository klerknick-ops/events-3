import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const terms = await prisma.paymentTerms.findMany({
    where: { organizationId: orgId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return ok(terms);
});

const schema = z.object({
  name: z.string().min(1),
  depositPercent: z.coerce.number().int().min(0).max(100).nullish(),
  body: z.string().min(1),
  sortOrder: z.coerce.number().int().optional(),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const term = await prisma.paymentTerms.create({
    data: {
      organizationId: orgId,
      name: body.name,
      depositPercent: body.depositPercent ?? null,
      body: body.body,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return created(term);
});
