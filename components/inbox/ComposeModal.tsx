"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { EventLinkSelect } from "./EventLinkSelect";

interface Signature {
  html: string;
  source: "exclaimer-api" | "static" | "generated";
  note: string;
}

// Compose a new email through the connected mailbox. The user's Exclaimer
// signature is auto-loaded into the body; the message can be linked to an event.
export function ComposeModal({
  onClose,
  onSent,
  presetEventId,
  presetTo,
}: {
  onClose: () => void;
  onSent: () => void;
  presetEventId?: string | null;
  presetTo?: string;
}) {
  const [to, setTo] = useState(presetTo ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [eventId, setEventId] = useState<string | null>(presetEventId ?? null);
  const [sig, setSig] = useState<Signature | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigInserted, setSigInserted] = useState(false);

  // Auto-load the Exclaimer signature and append it to the (empty) body.
  useEffect(() => {
    api
      .get<Signature>("/api/inbox/signature")
      .then((s) => {
        setSig(s);
        setBody((b) => (b ? b : s.html));
        setSigInserted(true);
      })
      .catch(() => setSig(null));
  }, []);

  async function send() {
    if (!to.trim()) return setError("Add at least one recipient.");
    if (!subject.trim()) return setError("Add a subject.");
    setSending(true);
    setError(null);
    try {
      await api.post("/api/inbox/send", { to, subject, body, eventId });
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="New email"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="To">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com, second@example.com"
            autoFocus
          />
        </Field>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Link to event (optional)">
          <EventLinkSelect value={eventId} onChange={(id) => setEventId(id)} />
          <p className="mt-1 text-xs text-ink-muted">
            Linked emails appear in that event&rsquo;s Inbox tab.
          </p>
        </Field>
        <Field label="Message">
          <Textarea
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-xs"
          />
          {sig ? (
            <div className="mt-1 flex items-center justify-between text-xs text-ink-muted">
              <span>
                {sigInserted ? "Signature inserted. " : ""}
                {sig.note}
              </span>
              <button
                type="button"
                className="text-brand-600 hover:underline dark:text-brand-300"
                onClick={() => setBody((b) => b + sig.html)}
              >
                Re-insert signature
              </button>
            </div>
          ) : null}
        </Field>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Modal>
  );
}
