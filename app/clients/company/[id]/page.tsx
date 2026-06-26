import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { type EventStatus } from "@/lib/enums";
import { computeEventTotals } from "@/lib/event-helpers";
import { formatMoney } from "@/lib/money";
import { formatDateTimeRange } from "@/lib/dates";
import { type EventRow } from "@/components/event/ContactEventList";
import { ClientProfileTabs } from "@/components/event/ClientProfileTabs";

export const dynamic = "force-dynamic";

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  const { id } = await params;
  const company = await prisma.company.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      contacts: {
        orderBy: { lastName: "asc" },
        include: {
          _count: { select: { events: true } },
          events: {
            orderBy: { createdAt: "desc" },
            include: {
              timeSlots: { orderBy: { startsAt: "asc" }, include: { space: true } },
              products: { include: { product: true, slot: true } },
              _count: { select: { tasks: true } },
            },
          },
        },
      },
    },
  });

  if (!company) notFound();

  // Aggregate every event across all company contacts into rows.
  const eventRows: EventRow[] = company.contacts
    .flatMap((c) => c.events)
    .map((ev) => {
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
      <Link href="/clients" className="text-sm text-ink-muted hover:text-ink">
        ← All clients
      </Link>

      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold text-ink">{company.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span>Company</span>
          {company.email ? <span>✉ {company.email}</span> : null}
          {company.phone ? <span>☎ {company.phone}</span> : null}
        </div>
        {company.notes ? (
          <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm text-ink-soft">{company.notes}</p>
        ) : null}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Contacts ({company.contacts.length})
      </h2>
      {company.contacts.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">No contacts at this company yet.</p>
      ) : (
        <div className="mb-6 divide-y divide-base rounded-xl border border-base">
          {company.contacts.map((c) => (
            <Link
              key={c.id}
              href={`/clients/contact/${c.id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2"
            >
              <span className="text-sm font-medium text-ink">
                {c.firstName} {c.lastName}
                {c.email ? <span className="ml-2 text-xs font-normal text-ink-muted">{c.email}</span> : null}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-muted">
                {c._count.events} events
              </span>
            </Link>
          ))}
        </div>
      )}

      <ClientProfileTabs events={eventRows} emailsEndpoint={`/api/companies/${company.id}/emails`} />
    </div>
  );
}
