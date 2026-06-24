import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

// List a space's setups (with their threshold rules). Used by config + slot editor.
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const space = await prisma.bookableSpace.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!space) return notFound("Space not found");
  const setups = await prisma.setup.findMany({
    where: { spaceId: id, archived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { rules: { orderBy: { minPersons: "asc" } } },
  });
  return ok(setups);
});

const ruleSchema = z.object({
  minPersons: z.coerce.number().int().min(0),
  tableCount: z.coerce.number().int().positive().nullish(),
  headTables: z.boolean().optional(),
  note: z.string().nullish(),
});
const schema = z.object({
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().optional(),
  rules: z.array(ruleSchema).default([]),
});

export const POST = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const space = await prisma.bookableSpace.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!space) return notFound("Space not found");
  const body = await parseBody(req, schema);
  const setup = await prisma.setup.create({
    data: {
      spaceId: id,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
      rules: {
        create: body.rules.map((r, i) => ({
          minPersons: r.minPersons,
          tableCount: r.tableCount ?? null,
          headTables: r.headTables ?? false,
          note: r.note || null,
          sortOrder: i,
        })),
      },
    },
    include: { rules: { orderBy: { minPersons: "asc" } } },
  });
  return created(setup);
});
