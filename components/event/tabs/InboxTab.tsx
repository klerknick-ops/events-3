"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { EmailMessage, EventFull } from "@/lib/types";
import { Button, Spinner } from "@/components/ui";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { EmailBody } from "@/components/inbox/EmailBody";
import { AttachmentList } from "@/components/inbox/AttachmentList";
import { buildReply, buildForward, type ComposePreset } from "@/components/inbox/quote";
import { Empty, SectionHeader } from "../PanelBits";

// Emails tied to this event — auto-matched client mail + manually-linked
// vendor/lead mail. Separate from the Activity tab.
export function InboxTab({ event }: { event: EventFull }) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposePreset | null>(null);

  function load() {
    setLoading(true);
    api.get<EmailMessage[]>(`/api/events/${event.id}/emails`).then((e) => {
      setEmails(e);
      setLoading(false);
    });
  }
  useEffect(load, [event.id]);

  async function remove(id: string) {
    if (!confirm("Remove this email from the event inbox? It can be recovered by an admin.")) return;
    await api.del(`/api/inbox/${id}`);
    setEmails((prev) => prev.filter((m) => m.id !== id));
  }

  async function archive(id: string) {
    await api.patch(`/api/inbox/${id}`, { archived: true });
    setEmails((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <SectionHeader title="Inbox" />
        <Button size="sm" variant="secondary" onClick={() => setCompose({ eventId: event.id })}>
          ✎ Compose
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6 text-ink-muted">
          <Spinner />
        </div>
      ) : emails.length === 0 ? (
        <Empty>
          No emails linked to this event yet. Client emails auto-match on sync; vendor/lead
          emails can be linked from the Inbox.
        </Empty>
      ) : (
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
                  {m.label ? <Tag>{m.label === "VENDOR" ? "Vendor" : "Supplier"}</Tag> : null}
                  {m.autoMatched ? <Tag tone="brand">Auto-matched</Tag> : null}
                  {m.direction === "OUTBOUND" ? <Tag tone="muted">Sent</Tag> : null}
                </div>
              </button>
              {open === m.id ? (
                <div className="border-t border-base p-3">
                  {m.ccAddresses ? (
                    <p className="mb-2 text-xs text-ink-muted">Cc: {m.ccAddresses}</p>
                  ) : null}
                  <EmailBody html={m.body} isHtml={m.bodyIsHtml} />
                  {m.attachments && m.attachments.length > 0 ? (
                    <AttachmentList attachments={m.attachments} className="mt-3" />
                  ) : null}
                  <div className="mt-3 flex flex-wrap justify-end gap-3 text-xs font-medium">
                    <button
                      onClick={() => setCompose(buildReply(m))}
                      className="text-brand-600 hover:underline dark:text-brand-300"
                    >
                      ↩ Reply
                    </button>
                    <button
                      onClick={() => setCompose(buildForward(m))}
                      className="text-brand-600 hover:underline dark:text-brand-300"
                    >
                      ➡ Forward
                    </button>
                    <button
                      onClick={() => archive(m.id)}
                      className="text-ink-muted hover:underline"
                    >
                      🗄 Archive
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      className="text-rose-600 hover:underline"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {compose ? (
        <ComposeModal
          presetEventId={compose.eventId ?? event.id}
          presetTo={compose.to}
          presetSubject={compose.subject}
          presetBody={compose.body}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null);
            load();
          }}
        />
      ) : null}
    </section>
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
