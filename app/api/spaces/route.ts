import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const spaces = await prisma.bookableSpace.findMany({
    where: { organizationId: orgId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return ok(spaces);
});

const createSchema = z.object({
  name: z.string().min(1),
  capacity: z.coerce.number().int().positive().nullish(),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, createSchema);
  const space = await prisma.bookableSpace.create({
    data: {
      organizationId: orgId,
      name: body.name,
      capacity: body.capacity ?? null,
      color: body.color ? (body.color.startsWith("#") ? body.color : `#${body.color}`) : undefined,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return created(space);
});
