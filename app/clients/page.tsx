"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/fetcher";
import type { Contact } from "@/lib/types";
import { Card, EmptyState, Input, Spinner } from "@/components/ui";

type Tab = "individuals" | "companies";

interface CompanyRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  _count?: { contacts: number };
}

export default function ClientsPage() {
  const [tab, setTab] = useState<Tab>("individuals");
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      if (tab === "individuals") {
        const r = await api.get<Contact[]>(`/api/contacts${qs}`);
        if (active) setContacts(r);
      } else {
        const r = await api.get<CompanyRow[]>(`/api/companies${qs}`);
        if (active) setCompanies(r);
      }
      if (active) setLoading(false);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, tab]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Clients</h1>
        <p className="text-sm text-ink-muted">Individual bookers and companies, with their history.</p>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-base bg-surface p-1">
        <TabBtn active={tab === "individuals"} onClick={() => setTab("individuals")} label="Individuals" />
        <TabBtn active={tab === "companies"} onClick={() => setTab("companies")} label="Companies" />
      </div>

      <div className="mb-4 max-w-md">
        <Input
          placeholder={tab === "individuals" ? "Search by name, email or company…" : "Search companies…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : tab === "individuals" ? (
        contacts.length === 0 ? (
          <EmptyState
            icon="👤"
            title="No contacts"
            description="Clients are created during the new-event flow. Start an event to add one."
          />
        ) : (
          <Card className="divide-y divide-base">
            {contacts.map((c) => (
              <Link
                key={c.id}
                href={`/clients/contact/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {c.company?.name ?? "Private individual"}
                    {c.email ? ` · ${c.email}` : ""}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-muted">
                  {c._count?.events ?? 0} events
                </span>
              </Link>
            ))}
          </Card>
        )
      ) : companies.length === 0 ? (
        <EmptyState icon="🏢" title="No companies" description="Companies are created when you assign a contact to one." />
      ) : (
        <Card className="divide-y divide-base">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/clients/company/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"
            >
              <div>
                <div className="text-sm font-medium text-ink">{c.name}</div>
                <div className="text-xs text-ink-muted">
                  {c.email ? c.email : "—"}
                  {c.phone ? ` · ${c.phone}` : ""}
                </div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-muted">
                {c._count?.contacts ?? 0} contacts
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
        (active ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300" : "text-ink-muted hover:bg-muted hover:text-ink")
      }
    >
      {label}
    </button>
  );
}
