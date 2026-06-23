import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_STATUS_LABELS, EVENT_STATUS_STYLES, type EventStatus } from "@/lib/enums";
import { computeEventTotals } from "@/lib/event-helpers";
import { formatMoney } from "@/lib/money";
import { formatDateTimeRange } from "@/lib/dates";

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

      {contact.events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-base p-6 text-center text-sm text-ink-muted">
          No events for this client yet.
        </p>
      ) : (
        <div className="space-y-3">
          {contact.events.map((ev) => {
            const { totals } = computeEventTotals(ev.products);
            const status = ev.status as EventStatus;
            const first = ev.timeSlots[0];
            return (
              <div
                key={ev.id}
                className="rounded-xl border border-base bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-ink">{ev.title}</div>
                    <div className="text-xs text-ink-muted">
                      {first
                        ? formatDateTimeRange(
                            new Date(first.startsAt),
                            new Date(first.endsAt),
                          )
                        : "No scheduled slots"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${EVENT_STATUS_STYLES[status].pill}`}
                  >
                    {EVENT_STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>🕑 {ev.timeSlots.length} slots</span>
                  <span>🍽 {ev.products.length} products</span>
                  <span>✓ {ev._count.tasks} tasks</span>
                  <span className="font-medium text-ink">
                    {formatMoney(totals.gross)} total
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
