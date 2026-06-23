import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

// Search contacts by name, email, or their company name — used by the
// client-lookup step of the new-event flow.
export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: orgId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { company: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      company: true,
      _count: { select: { events: true } },
    },
    take: q ? 25 : 100,
  });
  return ok(contacts);
});

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  notes: z.string().nullish(),
  companyId: z.string().nullish(),
  // Optionally create a new company in the same request.
  newCompanyName: z.string().nullish(),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrg();
  const body = await parseBody(req, schema);

  let companyId = body.companyId || null;
  if (companyId) {
    // Ensure the referenced company is in this org.
    const c = await prisma.company.findFirst({ where: { id: companyId, organizationId: orgId } });
    if (!c) companyId = null;
  }
  if (!companyId && body.newCompanyName?.trim()) {
    const company = await prisma.company.create({
      data: { organizationId: orgId, name: body.newCompanyName.trim() },
    });
    companyId = company.id;
  }

  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      notes: body.notes || null,
      companyId,
    },
    include: { company: true },
  });
  return created(contact);
});
