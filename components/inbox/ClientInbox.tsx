"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { EmailMessage } from "@/lib/types";
import { Card, EmptyState, Spinner } from "@/components/ui";
import { EmailBody } from "@/components/inbox/EmailBody";
import { AttachmentList } from "@/components/inbox/AttachmentList";

// Read-only inbox overview for a client (contact or company): all emails linked
// to them across their events plus pre-event lead correspondence.
export function ClientInbox({ endpoint }: { endpoint: string }) {
  const [emails, setEmails] = useState<EmailMessage[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<EmailMessage[]>(endpoint).then(setEmails).catch(() => setEmails([]));
  }, [endpoint]);

  if (!emails) {
    return (
      <div className="flex justify-center py-10 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  if (emails.length === 0) {
    return (
      <EmptyState
        icon="📨"
        title="No emails yet"
        description="Emails from this client — and any pre-event lead correspondence — will appear here."
      />
    );
  }

  return (
    <ol className="space-y-2">
      {emails.map((m) => (
        <li key={m.id} className="rounded-lg border border-base bg-surface">
          <button
            onClick={() => setOpen((o) => (o === m.id ? null : m.id))}
            className="block w-full p-3 text-left"
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
            <div className="mt-1 flex flex-wrap gap-1">
              {m.event ? <Tag tone="brand">🔗 {m.event.title}</Tag> : <Tag tone="muted">Lead</Tag>}
              {m.direction === "OUTBOUND" ? <Tag tone="muted">Sent</Tag> : null}
              {m.attachments && m.attachments.length > 0 ? <Tag tone="muted">📎 {m.attachments.length}</Tag> : null}
            </div>
          </button>
          {open === m.id ? (
            <div className="border-t border-base p-3">
              {m.ccAddresses ? <p className="mb-2 text-xs text-ink-muted">Cc: {m.ccAddresses}</p> : null}
              <EmailBody html={m.body} isHtml={m.bodyIsHtml} />
              {m.attachments && m.attachments.length > 0 ? (
                <AttachmentList attachments={m.attachments} className="mt-3" />
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "brand" | "muted" }) {
  const cls =
    tone === "brand"
      ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
      : "bg-muted text-ink-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
