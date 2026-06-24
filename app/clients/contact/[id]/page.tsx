import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { type EventStatus } from "@/lib/enums";
import { computeEventTotals } from "@/lib/event-helpers";
import { formatMoney } from "@/lib/money";
import { formatDateTimeRange } from "@/lib/dates";
import { ContactEventList, type EventRow } from "@/components/event/ContactEventList";

export const dynamic = "force-dynamic";

export default async function ContactHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  const { id } = await params;
  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      company: true,
      events: {
        orderBy: { createdAt: "desc" },
        include: {
          timeSlots: { orderBy: { startsAt: "asc" }, include: { space: true } },
          products: { include: { product: true, slot: true } },
          _count: { select: { tasks: true } },
        },
      },
    },
  });

  if (!contact) notFound();

  const eventRows: EventRow[] = contact.events.map((ev) => {
    const { totals } = computeEventTotals(ev.products);
    const first = ev.timeSlots[0];
    return {
      id: ev.id,
      title: ev.title,
      status: ev.status as EventStatus,
      dateLabel: first
        ? formatDateTimeRange(new Date(first.startsAt), new Date(first.endsAt))
        : "No scheduled slots",
      slots: ev.timeSlots.length,
      products: ev.products.length,
      tasks: ev._count.tasks,
      totalLabel: formatMoney(totals.gross),
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href="/clients"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← All clients
      </Link>

      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold text-ink">
          {contact.firstName} {contact.lastName}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span>{contact.company?.name ?? "Private individual"}</span>
          {contact.email ? <span>✉ {contact.email}</span> : null}
          {contact.phone ? <span>☎ {contact.phone}</span> : null}
        </div>
        {contact.notes ? (
          <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm text-ink-soft">
            {contact.notes}
          </p>
        ) : null}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Event history ({contact.events.length})
      </h2>

      {eventRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-base p-6 text-center text-sm text-ink-muted">
          No events for this client yet.
        </p>
      ) : (
        <ContactEventList events={eventRows} />
      )}
    </div>
  );
}
