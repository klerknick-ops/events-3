"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { PaymentTerms } from "@/lib/types";
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

export default function PaymentTermsPage() {
  const [items, setItems] = useState<PaymentTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentTerms | null>(null);

  async function load() {
    setLoading(true);
    setItems(await api.get<PaymentTerms[]>("/api/payment-terms?includeArchived=1"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Reusable deposit/balance presets. Chosen when creating an event and
          inserted into documents via the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{{payment_terms}}"}</code>{" "}
          variable.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New preset
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No payment terms yet"
          description="Add presets like “50% deposit, 50% on the day.”"
          action={<Button onClick={() => setShowForm(true)}>+ New preset</Button>}
        />
      ) : (
        <Card className="divide-y divide-base">
          {items.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{t.name}</span>
                  {t.depositPercent != null ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                      {t.depositPercent}% deposit
                    </span>
                  ) : null}
                  {t.archived ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                      archived
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{t.body}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(t);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (t.archived) await api.patch(`/api/payment-terms/${t.id}`, { archived: false });
                    else await api.del(`/api/payment-terms/${t.id}`);
                    load();
                  }}
                >
                  {t.archived ? "Restore" : "Archive"}
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm ? (
        <TermsForm
          term={editing}
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

function TermsForm({
  term,
  onClose,
  onSaved,
}: {
  term: PaymentTerms | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(term?.name ?? "");
  const [deposit, setDeposit] = useState(term?.depositPercent?.toString() ?? "");
  const [body, setBody] = useState(term?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Name is required");
    if (!body.trim()) return setError("Terms text is required");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        depositPercent: deposit === "" ? null : Number(deposit),
        body: body.trim(),
      };
      if (term) await api.patch(`/api/payment-terms/${term.id}`, payload);
      else await api.post("/api/payment-terms", payload);
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
      title={term ? "Edit payment terms" : "New payment terms"}
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
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="50% deposit / 50% on the day" autoFocus />
        </Field>
        <Field label="Deposit % (optional)">
          <Input type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="50" />
        </Field>
        <Field label="Terms text (used in documents)">
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="A 50% deposit is due on booking…" />
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
