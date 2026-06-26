import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

const ruleInclude = {
  spaces: { include: { space: { select: { id: true, name: true } } } },
} as const;

export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const rules = await prisma.notificationRule.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: ruleInclude,
  });
  return ok(rules);
});

const schema = z.object({
  targetType: z.enum(["SPACE", "PRODUCT", "SETUP"]),
  message: z.string().min(1),
  minPersons: z.coerce.number().int().min(0).nullish(),
  productId: z.string().nullish(),
  setupId: z.string().nullish(),
  spaceIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const rule = await prisma.notificationRule.create({
    data: {
      organizationId: orgId,
      targetType: body.targetType,
      message: body.message,
      minPersons: body.minPersons ?? null,
      productId: body.targetType === "PRODUCT" ? body.productId || null : null,
      setupId: body.targetType === "SETUP" ? body.setupId || null : null,
      active: body.active,
      spaces: { create: body.spaceIds.map((spaceId) => ({ spaceId })) },
    },
    include: ruleInclude,
  });
  return created(rule);
});
