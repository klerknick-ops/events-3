import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { TASK_DEADLINE_BASES } from "@/lib/enums";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const items = await prisma.taskTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: { title: "asc" },
  });
  return ok(items);
});

const schema = z.object({
  title: z.string().min(1),
  defaultAssignee: z.string().trim().nullish(),
  offsetDays: z.coerce.number().int().min(0),
  basis: z.enum(TASK_DEADLINE_BASES),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const item = await prisma.taskTemplate.create({
    data: {
      organizationId: orgId,
      title: body.title,
      defaultAssignee: body.defaultAssignee || null,
      offsetDays: body.offsetDays,
      basis: body.basis,
    },
  });
  return created(item);
});
