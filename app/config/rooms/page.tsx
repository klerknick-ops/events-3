"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import type { RoomType } from "@/lib/types";
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

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoomType | null>(null);

  async function load() {
    setLoading(true);
    setRooms(await api.get<RoomType[]>("/api/rooms?includeArchived=1"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Hotel room types booked by date range. Inventory drives availability
          checks.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New room type
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon="🛏"
          title="No room types yet"
          description="Add hotel room types so they can be booked on events."
          action={<Button onClick={() => setShowForm(true)}>+ New room type</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => {
            const t = lineTotals(r.priceNet, 1, r.taxRate);
            return (
              <Card key={r.id} className="overflow-hidden">
                <div className="aspect-[16/9] w-full bg-surface-2">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-ink-muted">
                      🛏
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-ink">{r.title}</h3>
                    {r.archived ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                        archived
                      </span>
                    ) : null}
                  </div>
                  {r.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{r.description}</p>
                  ) : null}
                  <div className="mt-3 space-y-1 rounded-lg bg-surface-2 p-2.5 text-xs">
                    <Row label="Net / night" value={formatMoney(t.net)} />
                    <Row label={`Tax (${r.taxRate}%)`} value={formatMoney(t.taxAmount)} />
                    <Row label="Gross / night" value={formatMoney(t.gross)} strong />
                    <Row label="Inventory" value={`${r.inventory} rooms`} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(r);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (r.archived) await api.patch(`/api/rooms/${r.id}`, { archived: false });
                        else await api.del(`/api/rooms/${r.id}`);
                        load();
                      }}
                    >
                      {r.archived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm ? (
        <RoomForm
          room={editing}
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{value}</span>
    </div>
  );
}

function RoomForm({
  room,
  onClose,
  onSaved,
}: {
  room: RoomType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(room?.title ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [priceNet, setPriceNet] = useState(room?.priceNet?.toString() ?? "");
  const [taxRate, setTaxRate] = useState(room?.taxRate?.toString() ?? "9");
  const [inventory, setInventory] = useState(room?.inventory?.toString() ?? "10");
  const [preview, setPreview] = useState<string | null>(room?.imageUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = lineTotals(Number(priceNet) || 0, 1, Number(taxRate) || 0);

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
      form.set("priceNet", String(Number(priceNet) || 0));
      form.set("taxRate", String(Number(taxRate) || 0));
      form.set("inventory", String(Number(inventory) || 1));
      const file = fileRef.current?.files?.[0];
      if (file) form.set("image", file);
      if (room) await api.form(`/api/rooms/${room.id}`, form, "PATCH");
      else await api.form("/api/rooms", form, "POST");
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
      title={room ? "Edit room type" : "New room type"}
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deluxe King" autoFocus />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Net / night">
              <Input type="number" step="0.01" value={priceNet} onChange={(e) => setPriceNet(e.target.value)} />
            </Field>
            <Field label="Tax (%)">
              <Input type="number" step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </Field>
            <Field label="Inventory">
              <Input type="number" value={inventory} onChange={(e) => setInventory(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Image">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border border-dashed border-base bg-surface-2">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-muted">No image</div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPreview(URL.createObjectURL(f));
              }}
            />
          </Field>
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Per-night breakdown
            </div>
            <Row label="Net" value={formatMoney(t.net)} />
            <Row label={`Tax (${Number(taxRate) || 0}%)`} value={formatMoney(t.taxAmount)} />
            <Row label="Gross" value={formatMoney(t.gross)} strong />
          </div>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Modal>
  );
}
