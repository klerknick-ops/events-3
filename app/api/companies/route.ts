import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const companies = await prisma.company.findMany({
    where: {
      organizationId: orgId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  return ok(companies);
});

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().nullish(),
  notes: z.string().nullish(),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrg();
  const body = await parseBody(req, schema);
  const company = await prisma.company.create({
    data: {
      organizationId: orgId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      notes: body.notes || null,
    },
  });
  return created(company);
});
