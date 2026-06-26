import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";

const patchSchema = z.object({
  label: z.enum(["VENDOR", "SUPPLIER"]).nullable().optional(),
  eventId: z.string().nullable().optional(), // manual link/unlink
  ownerId: z.string().nullable().optional(), // manual owner for lead emails
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(), // archive / unarchive
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
  if ("archived" in body) {
    if (body.archived) {
      // Archive is only allowed for emails connected to an event, or leads whose
      // sender has been linked to a Contact (Phase 6, Section 2).
      if (!existing.eventId && !existing.contactId) {
        return badRequest("Only event-linked or client-linked emails can be archived");
      }
      data.archivedAt = new Date();
    } else {
      data.archivedAt = null;
    }
  }
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
  if ("ownerId" in body) {
    if (body.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: body.ownerId, organizationId: orgId },
        select: { id: true },
      });
      if (!owner) return badRequest("User not found");
      data.ownerId = body.ownerId;
    } else {
      data.ownerId = null;
    }
  }

  const updated = await prisma.emailMessage.update({
    where: { id },
    data,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      event: {
        select: { id: true, title: true, assignedUser: { select: { id: true, name: true } } },
      },
      owner: { select: { id: true, name: true } },
      attachments: { select: { id: true, filename: true, contentType: true, size: true, isInline: true } },
    },
  });
  return ok(updated);
});

// Soft delete: hide from inbox views but keep the row (recoverable/auditable)
// and do NOT touch the live Microsoft 365 mailbox.
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const { id } = await ctx.params;
  const existing = await prisma.emailMessage.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!existing) return notFound("Email not found");
  await prisma.emailMessage.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
