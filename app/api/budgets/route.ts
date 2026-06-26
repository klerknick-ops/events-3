import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const budgets = await prisma.budget.findMany({
    where: { organizationId: orgId },
    orderBy: { month: "asc" },
  });
  return ok(budgets);
});

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.coerce.number().min(0),
});

// Upsert a month's budget target.
export const PUT = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const budget = await prisma.budget.upsert({
    where: { organizationId_month: { organizationId: orgId, month: body.month } },
    create: { organizationId: orgId, month: body.month, amount: body.amount },
    update: { amount: body.amount },
  });
  return ok(budget);
});
