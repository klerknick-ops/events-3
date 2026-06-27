"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useMe } from "@/components/MeProvider";
import { EventLinkSelect } from "./EventLinkSelect";
import { OwnerSelect } from "./OwnerSelect";
import { EmailBody } from "./EmailBody";

interface Signature {
  html: string;
  source: string;
  note: string;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Turn the composer's message into HTML: reply/forward presets already contain
// HTML (quoted thread); a freshly-typed plain message gets newline → <br>.
function messageToHtml(body: string): string {
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}

// Compose a new email through the connected mailbox. The org's native signature
// is auto-loaded (with the current user's name) and shown in a rendered preview;
// the message can carry CC, file attachments, a link to an event, and an
// optional follow-up task created before sending.
export function ComposeModal({
  onClose,
  onSent,
  presetEventId,
  presetTo,
  presetSubject,
  presetBody,
}: {
  onClose: () => void;
  onSent: () => void;
  presetEventId?: string | null;
  presetTo?: string;
  presetSubject?: string;
  presetBody?: string;
}) {
  const [to, setTo] = useState(presetTo ?? "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(presetSubject ?? "");
  const [body, setBody] = useState(presetBody ?? "");
  const [eventId, setEventId] = useState<string | null>(presetEventId ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [sig, setSig] = useState<Signature | null>(null);
  const [includeSig, setIncludeSig] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-send task (Section 6). Assignee defaults to the current user (Phase 6 §5).
  const me = useMe();
  const [addTask, setAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string | null>(me.user?.id ?? null);

  // Auto-load the native signature (rendered, with the current user's name).
  // Kept separate from the editable message so it renders cleanly rather than
  // appearing as raw markup in the textarea.
  useEffect(() => {
    api
      .get<Signature>("/api/inbox/signature")
      .then((s) => setSig(s))
      .catch(() => setSig(null));
  }, []);

  // Final HTML sent: the message, then the signature (if kept).
  function finalBodyHtml(): string {
    const msg = messageToHtml(body);
    return includeSig && sig ? `${msg}<br><br>${sig.html}` : msg;
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function send() {
    if (!to.trim()) return setError("Add at least one recipient.");
    if (!subject.trim()) return setError("Add a subject.");
    if (addTask && taskTitle.trim() && !taskDue) {
      return setError("A task needs a deadline.");
    }
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("to", to);
      fd.set("cc", cc);
      fd.set("subject", subject);
      fd.set("body", finalBodyHtml());
      if (eventId) fd.set("eventId", eventId);
      if (addTask && taskTitle.trim()) {
        fd.set("taskTitle", taskTitle);
        fd.set("taskDueDate", taskDue);
        if (taskAssigneeId) fd.set("taskAssigneeId", taskAssigneeId);
      }
      for (const f of files) fd.append("attachments", f);

      const res = await fetch("/api/inbox/send", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to send");
      }
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
          <div className="flex items-start gap-2">
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com, second@example.com"
              autoFocus
            />
            {!showCc ? (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="shrink-0 rounded-md px-2 py-2 text-xs font-medium text-brand-600 hover:bg-muted dark:text-brand-300"
              >
                + Cc
              </button>
            ) : null}
          </div>
        </Field>
        {showCc ? (
          <Field label="Cc">
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
            />
          </Field>
        ) : null}
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Link to event (optional)">
          <EventLinkSelect value={eventId} onChange={(id) => setEventId(id)} />
          <p className="mt-1 text-xs text-ink-muted">
            Linked emails appear in that event&rsquo;s Inbox tab. Sent mail with no
            event is filed under Leads &amp; Vendors → Sent.
          </p>
        </Field>
        <Field label="Message">
          <Textarea
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
          />
          {sig ? (
            <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={includeSig}
                onChange={(e) => setIncludeSig(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-base"
              />
              {sig.note}
            </label>
          ) : null}
          {/* Rendered preview (Outlook-style), including the auto-loaded
              signature — never raw markup. */}
          <div className="mt-2 rounded-lg border border-base bg-surface-2 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Preview
            </div>
            <EmailBody html={finalBodyHtml()} isHtml />
          </div>
        </Field>

        {/* Attachments */}
        <Field label="Attachments">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            📎 Attach files
          </Button>
          {files.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border border-base bg-surface-2 px-2 py-1 text-xs text-ink-soft"
                >
                  <span className="truncate">
                    {f.name} <span className="text-ink-muted">· {fmtSize(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="ml-2 shrink-0 text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Field>

        {/* Pre-send task */}
        <div className="rounded-lg border border-base p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={addTask}
              onChange={(e) => setAddTask(e.target.checked)}
            />
            Add a follow-up task
          </label>
          {addTask ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Task">
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Follow up in 3 days"
                />
              </Field>
              <Field label="Deadline (required)">
                <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
              </Field>
              <Field label="Assignee">
                <OwnerSelect value={taskAssigneeId} onChange={setTaskAssigneeId} placeholder="Unassigned" />
              </Field>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted">
            The task is tied to this email{eventId ? " and the linked event" : ""}; it
            survives even if the email is later deleted.
          </p>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Modal>
  );
}
