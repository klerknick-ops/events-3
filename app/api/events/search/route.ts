import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

// Lightweight event lookup for link-to-event pickers (inbox, etc.).
export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const events = await prisma.event.findMany({
    where: {
      organizationId: orgId,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { contact: { firstName: { contains: q, mode: "insensitive" } } },
              { contact: { lastName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      title: true,
      status: true,
      contact: { select: { firstName: true, lastName: true } },
      timeSlots: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
    },
  });

  return ok(
    events.map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      contactName: `${e.contact.firstName} ${e.contact.lastName}`,
      date: e.timeSlots[0]?.startsAt ?? null,
    })),
  );
});
