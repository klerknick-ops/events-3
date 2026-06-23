"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/fetcher";
import type { Contact } from "@/lib/types";
import { Card, EmptyState, Input, Spinner } from "@/components/ui";

export default function ClientsPage() {
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await api.get<Contact[]>(
        `/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      );
      if (active) {
        setContacts(r);
        setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Clients</h1>
        <p className="text-sm text-ink-muted">
          Contacts and companies, with their event history.
        </p>
      </div>

      <div className="mb-4 max-w-md">
        <Input
          placeholder="Search by name, email or company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : contacts.length === 0 ? (
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
      )}
    </div>
  );
}
