"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Product } from "@/lib/types";
import { formatMoney, lineTotals } from "@/lib/money";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Spinner,
  Textarea,
} from "@/components/ui";
import { Modal } from "@/components/Modal";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function load() {
    setLoading(true);
    setProducts(await api.get<Product[]>("/api/products?includeArchived=1"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Catalog items added to events. Each shows net, tax, and gross.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New product
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon="🍽"
          title="No products yet"
          description="Add catering items, AV gear, decorations or staff hours to your catalog."
          action={
            <Button onClick={() => setShowForm(true)}>+ New product</Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const t = lineTotals(p.priceNet, 1, p.taxRate);
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="aspect-[16/9] w-full bg-muted">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-ink-muted">
                      🖼
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-ink">{p.title}</h3>
                    {p.archived ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                        archived
                      </span>
                    ) : null}
                  </div>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                      {p.description}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-1 rounded-lg bg-surface-2 p-2.5 text-xs">
                    <Row label="Net" value={formatMoney(t.net)} />
                    <Row
                      label={`Tax (${p.taxRate}%)`}
                      value={formatMoney(t.taxAmount)}
                    />
                    <Row
                      label="Gross"
                      value={formatMoney(t.gross)}
                      strong
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(p);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (p.archived)
                          await api.patch(`/api/products/${p.id}`, {
                            archived: false,
                          });
                        else await api.del(`/api/products/${p.id}`);
                        load();
                      }}
                    >
                      {p.archived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm ? (
        <ProductForm
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>
        {value}
      </span>
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceNet, setPriceNet] = useState(product?.priceNet?.toString() ?? "");
  const [taxRate, setTaxRate] = useState(product?.taxRate?.toString() ?? "21");
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const net = Number(priceNet) || 0;
  const rate = Number(taxRate) || 0;
  const t = lineTotals(net, 1, rate);

  async function save() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", description);
      form.set("priceNet", String(net));
      form.set("taxRate", String(rate));
      const file = fileRef.current?.files?.[0];
      if (file) form.set("image", file);
      if (product) await api.form(`/api/products/${product.id}`, form, "PATCH");
      else await api.form("/api/products", form, "POST");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={product ? "Edit product" : "New product"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Plated 3-Course Dinner"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on the product card and function sheet."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Net price">
              <Input
                type="number"
                step="0.01"
                value={priceNet}
                onChange={(e) => setPriceNet(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Tax rate (%)">
              <Input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="21"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Image">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border border-dashed border-base bg-surface-2">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                  No image
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPreview(URL.createObjectURL(f));
              }}
            />
          </Field>

          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Live tax breakdown
            </div>
            <Row label="Net" value={formatMoney(t.net)} />
            <Row label={`Tax (${rate}%)`} value={formatMoney(t.taxAmount)} />
            <Row label="Gross" value={formatMoney(t.gross)} strong />
          </div>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Modal>
  );
}
