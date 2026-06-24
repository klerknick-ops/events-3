import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const ruleSchema = z.object({
  minPersons: z.coerce.number().int().min(0),
  tableCount: z.coerce.number().int().positive().nullish(),
  headTables: z.boolean().optional(),
  note: z.string().nullish(),
});
const schema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.coerce.number().int().optional(),
  archived: z.boolean().optional(),
  rules: z.array(ruleSchema).optional(),
});

async function ownedSetup(id: string, orgId: string) {
  return prisma.setup.findFirst({
    where: { id, space: { organizationId: orgId } },
  });
}

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  if (!(await ownedSetup(id, orgId))) return notFound("Setup not found");
  const body = await parseBody(req, schema);

  const setup = await prisma.$transaction(async (tx) => {
    await tx.setup.update({
      where: { id },
      data: { name: body.name, sortOrder: body.sortOrder, archived: body.archived },
    });
    if (body.rules) {
      await tx.setupRule.deleteMany({ where: { setupId: id } });
      await tx.setupRule.createMany({
        data: body.rules.map((r, i) => ({
          setupId: id,
          minPersons: r.minPersons,
          tableCount: r.tableCount ?? null,
          headTables: r.headTables ?? false,
          note: r.note || null,
          sortOrder: i,
        })),
      });
    }
    return tx.setup.findUnique({
      where: { id },
      include: { rules: { orderBy: { minPersons: "asc" } } },
    });
  });
  return ok(setup);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  if (!(await ownedSetup(id, orgId))) return notFound("Setup not found");
  const inUse = await prisma.eventTimeSlot.count({ where: { setupId: id } });
  if (inUse > 0) {
    const setup = await prisma.setup.update({ where: { id }, data: { archived: true } });
    return ok({ archived: true, setup });
  }
  await prisma.setup.delete({ where: { id } });
  return ok({ deleted: true });
});
