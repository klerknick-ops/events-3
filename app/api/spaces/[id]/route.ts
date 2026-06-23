import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().positive().nullable().optional(),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.coerce.number().int().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const existing = await prisma.bookableSpace.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) return notFound("Space not found");
  const body = await parseBody(req, patchSchema);
  const space = await prisma.bookableSpace.update({
    where: { id },
    data: {
      ...body,
      color: body.color
        ? body.color.startsWith("#")
          ? body.color
          : `#${body.color}`
        : undefined,
    },
  });
  return ok(space);
});

// Archive by default (preserves history). Hard-delete only when no slots exist.
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const existing = await prisma.bookableSpace.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) return notFound("Space not found");
  const slotCount = await prisma.eventTimeSlot.count({ where: { spaceId: id } });
  if (slotCount > 0) {
    const space = await prisma.bookableSpace.update({
      where: { id },
      data: { archived: true },
    });
    return ok({ archived: true, space });
  }
  await prisma.bookableSpace.delete({ where: { id } });
  return ok({ deleted: true });
});
