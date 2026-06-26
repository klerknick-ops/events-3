"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import type { EventFull, EventProduct, TimeSlot } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/dates";
import { computeEventTotals } from "@/lib/event-helpers";
import { Button, Field, Input } from "@/components/ui";
import { Empty, MoneyRow, QtyEditor } from "../PanelBits";
import { ProductPicker } from "../ProductPicker";

// Products are managed strictly per time slot (Phase 3). There is no longer a
// combined flat product list — each slot owns its lines. Totals are still
// computed across every slot for invoicing/documents.
export function ProductsTab({
  event,
  selectedDayId,
  reload,
}: {
  event: EventFull;
  selectedDayId: string | null;
  reload: () => void;
}) {
  const [pickerSlot, setPickerSlot] = useState<TimeSlot | null>(null);
  const [editLineId, setEditLineId] = useState<string | null>(null);
  const productById = new Map(event.products.map((p) => [p.id, p]));

  const multiDay = event.days.length > 1;
  const day = event.days.find((d) => d.id === selectedDayId) ?? event.days[0];
  const daySlots = event.timeSlots
    .filter((s) => (day ? s.dayId === day.id : true))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // All line totals, grouped by slot id.
  const { lines } = computeEventTotals(event.products);
  const linesBySlot = new Map<string | null, typeof lines>();
  for (const l of lines) {
    const arr = linesBySlot.get(l.slotId) ?? [];
    arr.push(l);
    linesBySlot.set(l.slotId, arr);
  }

  const dayProducts = event.products.filter((p) =>
    multiDay && day ? p.dayId === day.id : true,
  );
  const dayTotals = computeEventTotals(dayProducts).totals;
  const eventTotals = computeEventTotals(event.products).totals;

  // Legacy/unassigned products (no slot) — surfaced so nothing is hidden.
  const orphanLines = (linesBySlot.get(null) ?? []).filter((l) =>
    multiDay && day
      ? dayProducts.some((p) => p.id === l.id)
      : true,
  );

  return (
    <section className="space-y-4">
      {daySlots.length === 0 ? (
        <Empty>Add a time slot first — products are organised per slot.</Empty>
      ) : (
        daySlots.map((slot) => {
          const slotLines = linesBySlot.get(slot.id) ?? [];
          return (
            <div key={slot.id} className="rounded-xl border border-base">
              <div className="flex items-start justify-between gap-2 border-b border-base px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">
                    {slot.label ? `${slot.label} · ` : ""}
                    {slot.space?.name}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatTime(new Date(slot.startsAt))}–{formatTime(new Date(slot.endsAt))} ·{" "}
                    {slot.personCount} guest{slot.personCount === 1 ? "" : "s"}
                  </div>
                </div>
                <Button size="sm" variant="subtle" onClick={() => setPickerSlot(slot)}>
                  + Add product
                </Button>
              </div>

              {slotLines.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-muted">No products on this slot yet.</p>
              ) : (
                <div className="divide-y divide-base">
                  {slotLines.map((l) => {
                    const ep = productById.get(l.id);
                    return (
                      <div key={l.id}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink">
                              {l.title}
                              {ep?.nameOverride ? (
                                <span className="ml-1 text-xs font-normal text-ink-muted">(renamed)</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {formatMoney(l.unitNet)} net · {l.taxRate}% tax
                              {ep?.unitPriceNetOverride != null ? " · price overridden" : ""}
                            </div>
                            {l.note ? (
                              <div className="mt-0.5 text-xs italic text-ink-muted">📝 {l.note}</div>
                            ) : null}
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
                            className="text-ink-muted hover:text-ink"
                            onClick={() => setEditLineId((id) => (id === l.id ? null : l.id))}
                            title="Edit name / price / note"
                          >
                            ✎
                          </button>
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
                        {editLineId === l.id && ep ? (
                          <LineOverrideEditor
                            ep={ep}
                            onClose={() => setEditLineId(null)}
                            onSaved={() => {
                              setEditLineId(null);
                              reload();
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {orphanLines.length > 0 ? (
        <div className="rounded-xl border border-dashed border-base">
          <div className="border-b border-base px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Not assigned to a slot
          </div>
          <div className="divide-y divide-base">
            {orphanLines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{l.title}</div>
                </div>
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
      ) : null}

      {/* Totals (for invoicing/documents — not a separate product list). */}
      <div className="space-y-3">
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
            <MoneyRow key={r.taxRate} small label={`Tax @ ${r.taxRate}%`} value={formatMoney(r.taxAmount)} />
          ))}
          <MoneyRow label="Total" value={formatMoney(eventTotals.gross)} strong />
        </div>
      </div>

      {pickerSlot ? (
        <ProductPicker
          slot={pickerSlot}
          onClose={() => setPickerSlot(null)}
          onAdd={async (input) => {
            await api.post(`/api/events/${event.id}/products`, {
              ...input,
              slotId: pickerSlot.id,
            });
            reload();
          }}
        />
      ) : null}
    </section>
  );
}

// Per-line overrides for this booking only: rename, override net price, and a
// note (rendered on documents). Leaving name/price blank clears the override
// and falls back to the master catalog product.
function LineOverrideEditor({
  ep,
  onClose,
  onSaved,
}: {
  ep: EventProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(ep.nameOverride ?? "");
  const [price, setPrice] = useState(
    ep.unitPriceNetOverride != null ? String(ep.unitPriceNetOverride) : "",
  );
  const [note, setNote] = useState(ep.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/api/event-products/${ep.id}`, {
        nameOverride: name.trim() || null,
        unitPriceNetOverride: price.trim() === "" ? null : Number(price),
        notes: note.trim() || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-base bg-surface-2 px-3 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Name override (default: ${ep.product.title})`}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={ep.product.title} />
        </Field>
        <Field label={`Net price override (default: ${formatMoney(ep.product.priceNet)})`}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={String(ep.product.priceNet)}
          />
        </Field>
      </div>
      <Field label="Note (shown on documents)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. no nuts, gluten-free" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
