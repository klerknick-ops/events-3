"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import type { EventFull } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { computeEventTotals } from "@/lib/event-helpers";
import { Button } from "@/components/ui";
import { Empty, MoneyRow, QtyEditor, SectionHeader } from "../PanelBits";
import { ProductPicker } from "../ProductPicker";

export function ProductsTab({
  event,
  selectedDayId,
  reload,
}: {
  event: EventFull;
  selectedDayId: string | null;
  reload: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const multiDay = event.days.length > 1;
  const day = event.days.find((d) => d.id === selectedDayId) ?? event.days[0];
  const dayProducts = event.products.filter((p) =>
    multiDay && day ? p.dayId === day.id : true,
  );
  const daySlots = event.timeSlots.filter((s) => (day ? s.dayId === day.id : true));

  const { lines } = computeEventTotals(dayProducts);
  const dayTotals = computeEventTotals(dayProducts).totals;
  const eventTotals = computeEventTotals(event.products).totals;

  const slotName = (slotId: string | null) => {
    if (!slotId) return "Whole day";
    const s = event.timeSlots.find((x) => x.id === slotId);
    return s?.label || s?.space?.name || "Slot";
  };

  const groups = new Map<string | null, typeof lines>();
  for (const l of lines) {
    const arr = groups.get(l.slotId) ?? [];
    arr.push(l);
    groups.set(l.slotId, arr);
  }

  return (
    <section>
      <SectionHeader
        title={multiDay ? "Products on this day" : "Products"}
        action={
          <Button size="sm" variant="subtle" onClick={() => setShowPicker(true)}>
            + Add product
          </Button>
        }
      />
      {lines.length === 0 ? (
        <Empty>No products added{multiDay ? " on this day" : ""} yet.</Empty>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([slotId, gLines]) => (
            <div key={slotId ?? "day"}>
              {groups.size > 1 || slotId ? (
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {slotName(slotId)}
                </div>
              ) : null}
              <div className="divide-y divide-base rounded-lg border border-base">
                {gLines.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {l.title}
                      </div>
                      <div className="text-xs text-ink-muted">
                        {formatMoney(l.unitNet)} net · {l.taxRate}% tax
                      </div>
                    </div>
                    <QtyEditor
                      value={l.quantity}
                      onChange={async (q) => {
                        await api.patch(`/api/event-products/${l.id}`, { quantity: q });
                        reload();
                      }}
                    />
                    <div className="w-20 text-right text-sm font-medium text-ink">
                      {formatMoney(l.totals.gross)}
                    </div>
                    <button
                      className="text-ink-muted hover:text-rose-600"
                      onClick={async () => {
                        await api.del(`/api/event-products/${l.id}`);
                        reload();
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {multiDay ? (
          <div className="rounded-lg border border-base bg-surface-2 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              This day
            </div>
            <MoneyRow label="Net" value={formatMoney(dayTotals.net)} />
            <MoneyRow label="Tax" value={formatMoney(dayTotals.taxAmount)} small />
            <MoneyRow label="Total" value={formatMoney(dayTotals.gross)} strong />
          </div>
        ) : null}
        <div className="rounded-lg border border-base bg-surface-2 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Whole event
          </div>
          <MoneyRow label="Net" value={formatMoney(eventTotals.net)} />
          {eventTotals.byRate.map((r) => (
            <MoneyRow
              key={r.taxRate}
              small
              label={`Tax @ ${r.taxRate}%`}
              value={formatMoney(r.taxAmount)}
            />
          ))}
          <MoneyRow label="Total" value={formatMoney(eventTotals.gross)} strong />
        </div>
      </div>

      {showPicker ? (
        <ProductPicker
          slots={daySlots}
          onClose={() => setShowPicker(false)}
          onAdd={async (input) => {
            await api.post(`/api/events/${event.id}/products`, {
              ...input,
              dayId: day?.id ?? null,
            });
            reload();
          }}
        />
      ) : null}
    </section>
  );
}
