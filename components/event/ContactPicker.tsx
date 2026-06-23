"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Company, Contact } from "@/lib/types";
import { Button, Field, Input, Spinner } from "@/components/ui";

// Step 1 of event creation: find an existing contact or create a new one
// (optionally with a new or existing company).
export function ContactPicker({
  onSelect,
}: {
  onSelect: (contact: Contact) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await api.get<Contact[]>(
        `/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      );
      if (active) {
        setResults(r);
        setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  if (creating) {
    return (
      <NewContactForm
        defaultName={q}
        onCancel={() => setCreating(false)}
        onCreated={onSelect}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Find a client">
        <Input
          autoFocus
          placeholder="Search by name, email or company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Field>

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6 text-ink-muted">
            <Spinner />
          </div>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">
            No matching contacts.
          </p>
        ) : (
          results.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="flex w-full items-center justify-between rounded-lg border border-base px-3 py-2 text-left hover:border-brand-300 hover:bg-accent"
            >
              <div>
                <div className="text-sm font-medium text-ink">
                  {c.firstName} {c.lastName}
                </div>
                <div className="text-xs text-ink-muted">
                  {c.company?.name ?? "Private individual"}
                  {c.email ? ` · ${c.email}` : ""}
                </div>
              </div>
              <span className="text-xs text-ink-muted">
                {c._count?.events ?? 0} events
              </span>
            </button>
          ))
        )}
      </div>

      <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
        + Create new client
      </Button>
    </div>
  );
}

function NewContactForm({
  defaultName,
  onCancel,
  onCreated,
}: {
  defaultName: string;
  onCancel: () => void;
  onCreated: (c: Contact) => void;
}) {
  const parts = defaultName.trim().split(" ");
  const [firstName, setFirstName] = useState(parts[0] ?? "");
  const [lastName, setLastName] = useState(parts.slice(1).join(" "));
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Company[]>("/api/companies").then(setCompanies);
  }, []);

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const c = await api.post<Contact>("/api/contacts", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        companyId: companyId || null,
        newCompanyName: companyId ? null : newCompanyName.trim() || null,
      });
      onCreated(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <Field label="Company (optional)">
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="h-10 w-full rounded-lg border border-base px-3 text-sm"
        >
          <option value="">— None / private individual —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {!companyId ? (
        <Field label="…or new company name">
          <Input
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder="Acme Industries"
          />
        </Field>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? "Creating…" : "Create client"}
        </Button>
      </div>
    </div>
  );
}
