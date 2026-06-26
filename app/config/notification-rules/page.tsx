"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import type { NotificationRule, NotificationTargetType, Product, Setup, Space } from "@/lib/types";
import { Button, Card, EmptyState, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";

const TARGET_LABELS: Record<NotificationTargetType, string> = {
  SPACE: "Space",
  PRODUCT: "Product",
  SETUP: "Setup",
};

export default function NotificationRulesPage() {
  const [items, setItems] = useState<NotificationRule[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [setups, setSetups] = useState<(Setup & { spaceName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NotificationRule | null>(null);

  async function load() {
    setLoading(true);
    const [rules, sp, pr] = await Promise.all([
      api.get<NotificationRule[]>("/api/notification-rules"),
      api.get<Space[]>("/api/spaces"),
      api.get<Product[]>("/api/products"),
    ]);
    setItems(rules);
    setSpaces(sp);
    setProducts(pr);
    // Flatten setups across spaces.
    const setupLists = await Promise.all(
      sp.map((s) =>
        api
          .get<Setup[]>(`/api/spaces/${s.id}/setups`)
          .then((list) => list.map((x) => ({ ...x, spaceName: s.name })))
          .catch(() => []),
      ),
    );
    setSetups(setupLists.flat());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const spaceName = (id: string) => spaces.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Constraints &amp; reminders surfaced (non-blocking) while planning — e.g. “The garden may
          not be entered before 10:00.”
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New rule
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No notification rules yet"
          description="Add planning constraints staff should be warned about."
          action={<Button onClick={() => setShowForm(true)}>+ New rule</Button>}
        />
      ) : (
        <Card className="divide-y divide-base">
          {items.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                    {TARGET_LABELS[r.targetType]}
                  </span>
                  {!r.active ? <span className="text-xs text-ink-muted">(inactive)</span> : null}
                  {r.minPersons != null ? (
                    <span className="text-xs text-ink-muted">≥ {r.minPersons} guests</span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-ink">{r.message}</div>
                <div className="mt-0.5 text-xs text-ink-muted">
                  {r.targetType === "PRODUCT"
                    ? products.find((p) => p.id === r.productId)?.title ?? "—"
                    : r.targetType === "SETUP"
                      ? setups.find((s) => s.id === r.setupId)?.name ?? "—"
                      : "Spaces: " + (r.spaces.map((s) => spaceName(s.spaceId)).join(", ") || "—")}
                  {r.targetType !== "SPACE" && r.spaces.length > 0
                    ? ` · in ${r.spaces.map((s) => spaceName(s.spaceId)).join(", ")}`
                    : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
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
                    await api.del(`/api/notification-rules/${r.id}`);
                    load();
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm ? (
        <RuleForm
          rule={editing}
          spaces={spaces}
          products={products}
          setups={setups}
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

function RuleForm({
  rule,
  spaces,
  products,
  setups,
  onClose,
  onSaved,
}: {
  rule: NotificationRule | null;
  spaces: Space[];
  products: Product[];
  setups: (Setup & { spaceName: string })[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(rule);
  const [targetType, setTargetType] = useState<NotificationTargetType>(rule?.targetType ?? "SPACE");
  const [message, setMessage] = useState(rule?.message ?? "");
  const [minPersons, setMinPersons] = useState(rule?.minPersons != null ? String(rule.minPersons) : "");
  const [productId, setProductId] = useState(rule?.productId ?? "");
  const [setupId, setSetupId] = useState(rule?.setupId ?? "");
  const [spaceIds, setSpaceIds] = useState<string[]>(rule?.spaces.map((s) => s.spaceId) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupOptions = useMemo(
    () => setups.map((s) => ({ id: s.id, label: `${s.name} (${s.spaceName})` })),
    [setups],
  );

  function toggleSpace(id: string) {
    setSpaceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function save() {
    if (!message.trim()) return setError("A message is required");
    if (targetType === "SPACE" && spaceIds.length === 0)
      return setError("Pick at least one space");
    if (targetType === "PRODUCT" && !productId) return setError("Pick a product");
    if (targetType === "SETUP" && !setupId) return setError("Pick a setup");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        targetType,
        message: message.trim(),
        minPersons: minPersons.trim() === "" ? null : Number(minPersons),
        productId: targetType === "PRODUCT" ? productId : null,
        setupId: targetType === "SETUP" ? setupId : null,
        spaceIds,
        active: rule?.active ?? true,
      };
      if (rule) {
        // Target type / target id are fixed after creation; update the rest.
        await api.patch(`/api/notification-rules/${rule.id}`, {
          message: payload.message,
          minPersons: payload.minPersons,
          spaceIds,
        });
      } else {
        await api.post("/api/notification-rules", payload);
      }
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
      title={rule ? "Edit notification rule" : "New notification rule"}
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
      <div className="space-y-4">
        <Field label="Target type">
          <Select
            value={targetType}
            disabled={editing}
            onChange={(e) => setTargetType(e.target.value as NotificationTargetType)}
          >
            <option value="SPACE">Space</option>
            <option value="PRODUCT">Product</option>
            <option value="SETUP">Setup</option>
          </Select>
        </Field>

        {targetType === "PRODUCT" ? (
          <Field label="Product">
            <Select value={productId} disabled={editing} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— Select —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {targetType === "SETUP" ? (
          <Field label="Setup">
            <Select value={setupId} disabled={editing} onChange={(e) => setSetupId(e.target.value)}>
              <option value="">— Select —</option>
              {setupOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Message (shown to staff)">
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. The garden may not be entered before 10:00."
          />
        </Field>

        <Field label="Person-count condition (optional)">
          <Input
            type="number"
            min={0}
            value={minPersons}
            onChange={(e) => setMinPersons(e.target.value)}
            placeholder="Only warn at/above this many guests"
          />
        </Field>

        <Field
          label={
            targetType === "SPACE"
              ? "Applies to space(s)"
              : "Limit to space(s) (optional)"
          }
        >
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-base p-2">
            {spaces.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={spaceIds.includes(s.id)}
                  onChange={() => toggleSpace(s.id)}
                  className="h-4 w-4 rounded border-base"
                />
                {s.name}
              </label>
            ))}
          </div>
        </Field>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
