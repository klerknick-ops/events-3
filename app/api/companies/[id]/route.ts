import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const company = await prisma.company.findFirst({
    where: { id, organizationId: orgId },
    include: {
      contacts: {
        orderBy: { lastName: "asc" },
        include: {
          _count: { select: { events: true } },
          events: {
            orderBy: { createdAt: "desc" },
            include: { timeSlots: { orderBy: { startsAt: "asc" }, take: 1 } },
          },
        },
      },
    },
  });
  if (!company) return notFound("Company not found");
  return ok(company);
});

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  notes: z.string().nullish(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const owned = await prisma.company.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Company not found");
  const body = await parseBody(req, schema);
  const company = await prisma.company.update({ where: { id }, data: body });
  return ok(company);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const owned = await prisma.company.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Company not found");
  await prisma.company.delete({ where: { id } });
  return ok({ deleted: true });
});
