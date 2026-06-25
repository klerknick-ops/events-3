"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { EmailMessage, EmailLabel, InboxResponse } from "@/lib/types";
import { useMe } from "@/components/MeProvider";
import { Button, Card, EmptyState, Select, Spinner } from "@/components/ui";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { EventLinkSelect } from "@/components/inbox/EventLinkSelect";

type View = "client" | "leads";

export default function InboxPage() {
  const { permissions } = useMe();
  const allowed = Boolean(permissions.VIEW_GLOBAL_ACTIVITY);

  const [view, setView] = useState<View>("client");
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [compose, setCompose] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.get<InboxResponse>(`/api/inbox?view=${view}`);
    setData(r);
    setSelected((s) => r.messages.find((m) => m.id === s?.id) ?? r.messages[0] ?? null);
    setLoading(false);
  }, [view]);

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
  }, [allowed, load]);

  async function sync() {
    setSyncing(true);
    try {
      await api.post("/api/inbox/sync");
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function update(id: string, patch: Partial<Pick<EmailMessage, "label" | "eventId" | "isRead">>) {
    const updated = await api.patch<EmailMessage>(`/api/inbox/${id}`, patch);
    setData((d) =>
      d ? { ...d, messages: d.messages.map((m) => (m.id === id ? { ...m, ...updated } : m)) } : d,
    );
    setSelected((s) => (s && s.id === id ? { ...s, ...updated } : s));
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState icon="🔒" title="Managers & admins only" description="You don't have access to the connected inbox." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Inbox</h1>
          <p className="text-sm text-ink-muted">
            {data?.configured
              ? `Connected to ${data.mailbox}`
              : "Demo mode — Microsoft 365 not connected. Sync loads sample mail."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={sync} disabled={syncing}>
            {syncing ? "Syncing…" : "↻ Sync"}
          </Button>
          <Button size="sm" onClick={() => setCompose(true)}>
            ✎ Compose
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-base bg-surface p-1">
        <ViewTab active={view === "client"} onClick={() => setView("client")} label="Client Mail" count={data?.counts.client} />
        <ViewTab active={view === "leads"} onClick={() => setView("leads")} label="Leads & Vendors" count={data?.counts.leads} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-ink-muted">
          <Spinner />
        </div>
      ) : !data || data.messages.length === 0 ? (
        <EmptyState
          icon="📨"
          title={view === "client" ? "No client mail yet" : "No leads or vendor mail yet"}
          description={
            view === "client"
              ? "Emails from clients with an event will appear here automatically after a sync."
              : "Vendor, supplier and new-lead emails land here. Tag them and link them to an event."
          }
          action={<Button onClick={sync}>↻ Sync now</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          {/* Message list */}
          <div className="space-y-2">
            {data.messages.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className={
                  "block w-full rounded-xl border p-3 text-left transition " +
                  (selected?.id === m.id
                    ? "border-brand-500 bg-accent/60 dark:bg-brand-600/10"
                    : "border-base bg-surface hover:border-brand-300")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {m.direction === "OUTBOUND" ? `To: ${m.toAddresses}` : m.fromName || m.fromAddress}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-muted">
                    {new Date(m.receivedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="truncate text-sm text-ink-soft">{m.subject}</div>
                <div className="truncate text-xs text-ink-muted">{m.bodyPreview}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.label ? <Tag>{m.label === "VENDOR" ? "Vendor" : "Supplier"}</Tag> : null}
                  {m.event ? <Tag tone="brand">{m.autoMatched ? "↪ " : "🔗 "}{m.event.title}</Tag> : null}
                  {m.direction === "OUTBOUND" ? <Tag tone="muted">Sent</Tag> : null}
                </div>
              </button>
            ))}
          </div>

          {/* Reading pane */}
          <div>
            {selected ? (
              <MessagePane key={selected.id} message={selected} view={view} onUpdate={update} onReply={() => setCompose(true)} />
            ) : (
              <Card className="p-8 text-center text-sm text-ink-muted">Select a message.</Card>
            )}
          </div>
        </div>
      )}

      {compose ? (
        <ComposeModal
          presetEventId={selected?.eventId ?? null}
          presetTo={selected && selected.direction === "INBOUND" ? selected.fromAddress : undefined}
          onClose={() => setCompose(false)}
          onSent={() => {
            setCompose(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function MessagePane({
  message,
  view,
  onUpdate,
  onReply,
}: {
  message: EmailMessage;
  view: View;
  onUpdate: (id: string, patch: Partial<Pick<EmailMessage, "label" | "eventId" | "isRead">>) => Promise<void>;
  onReply: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{message.subject}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {message.direction === "OUTBOUND" ? "To " : "From "}
            <span className="font-medium">{message.fromName || message.fromAddress}</span>
            {message.direction === "INBOUND" ? ` <${message.fromAddress}>` : ` ${message.toAddresses}`}
          </p>
          <p className="text-xs text-ink-muted">
            {new Date(message.receivedAt).toLocaleString()}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onReply}>
          ↩ Reply
        </Button>
      </div>

      {/* Tagging + linking controls (Leads & Vendors) */}
      {view === "leads" ? (
        <div className="mb-4 grid gap-3 rounded-lg border border-base bg-surface-2 p-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Label</label>
            <Select
              value={message.label ?? ""}
              onChange={(e) =>
                onUpdate(message.id, { label: (e.target.value || null) as EmailLabel | null })
              }
            >
              <option value="">Untagged (lead)</option>
              <option value="VENDOR">Vendor</option>
              <option value="SUPPLIER">Supplier</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Link to event</label>
            <EventLinkSelect
              value={message.eventId}
              onChange={(id) => onUpdate(message.id, { eventId: id })}
            />
          </div>
        </div>
      ) : message.event ? (
        <div className="mb-4 rounded-lg border border-base bg-surface-2 p-3 text-sm text-ink-soft">
          {message.autoMatched ? "Auto-matched to " : "Linked to "}
          <span className="font-medium text-ink">{message.event.title}</span>
          {message.contact ? ` · ${message.contact.firstName} ${message.contact.lastName}` : ""}
        </div>
      ) : null}

      {/* Body */}
      {message.bodyIsHtml ? (
        <div
          className="prose-email max-w-none text-sm text-ink-soft [&_a]:text-brand-600 dark:[&_a]:text-brand-300"
          dangerouslySetInnerHTML={{ __html: message.body }}
        />
      ) : (
        <pre className="whitespace-pre-wrap text-sm text-ink-soft">{message.body}</pre>
      )}
    </Card>
  );
}

function ViewTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
        (active ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300" : "text-ink-muted hover:bg-muted hover:text-ink")
      }
    >
      {label}
      {typeof count === "number" ? <span className="ml-1.5 text-xs text-ink-muted">({count})</span> : null}
    </button>
  );
}

function Tag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" | "muted" }) {
  const cls =
    tone === "brand"
      ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
      : tone === "muted"
        ? "bg-muted text-ink-muted"
        : "border border-base text-ink-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
