import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

const patchSchema = z.object({
  label: z.enum(["VENDOR", "SUPPLIER"]).nullable().optional(),
  eventId: z.string().nullable().optional(), // manual link/unlink
  isRead: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// Update an email: tag Vendor/Supplier, link/unlink to an event, mark read.
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const { id } = await ctx.params;
  const existing = await prisma.emailMessage.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) return notFound("Email not found");

  const body = await parseBody(req, patchSchema);
  const data: Record<string, unknown> = {};
  if ("label" in body) data.label = body.label ?? null;
  if ("isRead" in body) data.isRead = body.isRead;
  if ("eventId" in body) {
    if (body.eventId) {
      const event = await prisma.event.findFirst({
        where: { id: body.eventId, organizationId: orgId },
        select: { id: true },
      });
      if (!event) return badRequest("Event not found");
      data.eventId = body.eventId;
      data.autoMatched = false; // manual link
    } else {
      data.eventId = null;
      data.autoMatched = false;
    }
  }

  const updated = await prisma.emailMessage.update({ where: { id }, data });
  return ok(updated);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const { id } = await ctx.params;
  const existing = await prisma.emailMessage.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!existing) return notFound("Email not found");
  await prisma.emailMessage.delete({ where: { id } });
  return ok({ deleted: true });
});
