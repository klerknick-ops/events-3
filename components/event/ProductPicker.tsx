"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Product, TimeSlot } from "@/lib/types";
import { formatMoney, lineTotals } from "@/lib/money";
import { Button, Input, Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";

// Add a catalog product to a specific time slot. Per-person products default
// their quantity to the slot's person count (still editable before adding).
export function ProductPicker({
  slot,
  onAdd,
  onClose,
}: {
  slot: TimeSlot;
  onAdd: (input: { productId: string; quantity: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [qtyTouched, setQtyTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Product[]>("/api/products").then((p) => {
      setProducts(p);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => products.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())),
    [products, q],
  );

  // When a product is picked, default the quantity: per-person → slot headcount.
  function pick(p: Product) {
    setSelected(p);
    if (!qtyTouched) {
      setQuantity(
        p.pricingMode === "PER_PERSON" ? Math.max(1, slot.personCount) : 1,
      );
    }
  }

  const preview = selected
    ? lineTotals(selected.priceNet, quantity, selected.taxRate)
    : null;
  const perPerson = selected?.pricingMode === "PER_PERSON";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Add product · ${slot.label || slot.space?.name || "Slot"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selected || saving}
            onClick={async () => {
              if (!selected) return;
              setSaving(true);
              await onAdd({ productId: selected.id, quantity });
              setSaving(false);
              onClose();
            }}
          >
            {saving ? "Adding…" : "Add to slot"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Input
            placeholder="Search products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6 text-ink-muted">
                <Spinner />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">No products found.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p)}
                  className={
                    "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition " +
                    (selected?.id === p.id
                      ? "border-brand-500 bg-accent"
                      : "border-base hover:border-brand-300")
                  }
                >
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                    <span className="block text-xs text-ink-muted">
                      {formatMoney(p.priceNet)} net · {p.taxRate}% tax ·{" "}
                      {p.pricingMode === "PER_PERSON" ? "per person" : "per piece"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          {selected ? (
            <>
              <div className="rounded-lg border border-base p-3">
                <div className="text-sm font-medium text-ink">{selected.title}</div>
                {selected.description ? (
                  <p className="mt-1 text-xs text-ink-muted">{selected.description}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Quantity
                </label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => {
                    setQtyTouched(true);
                    setQuantity(Math.max(1, Number(e.target.value) || 1));
                  }}
                />
                {perPerson ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    Per person — defaulted to this slot&rsquo;s {slot.personCount} guest
                    {slot.personCount === 1 ? "" : "s"}. Adjust if needed.
                  </p>
                ) : null}
              </div>
              {preview ? (
                <div className="rounded-lg bg-surface-2 p-3 text-sm">
                  <div className="flex justify-between text-ink-soft">
                    <span>Net</span>
                    <span>{formatMoney(preview.net)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-ink-muted">
                    <span>Tax ({selected.taxRate}%)</span>
                    <span>{formatMoney(preview.taxAmount)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-base pt-1 font-semibold text-ink">
                    <span>Total</span>
                    <span>{formatMoney(preview.gross)}</span>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-ink-muted">
              Select a product to configure quantity.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
