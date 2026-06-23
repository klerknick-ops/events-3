import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

// Full contact with event history (used by the contact history view).
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: orgId },
    include: {
      company: true,
      events: {
        orderBy: { createdAt: "desc" },
        include: {
          timeSlots: { orderBy: { startsAt: "asc" } },
          _count: { select: { products: true, tasks: true } },
        },
      },
    },
  });
  if (!contact) return notFound("Contact not found");
  return ok(contact);
});

const schema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  notes: z.string().nullish(),
  companyId: z.string().nullable().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const owned = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Contact not found");
  const body = await parseBody(req, schema);
  const contact = await prisma.contact.update({
    where: { id },
    data: body,
    include: { company: true },
  });
  return ok(contact);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const owned = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Contact not found");
  await prisma.contact.delete({ where: { id } });
  return ok({ deleted: true });
});
