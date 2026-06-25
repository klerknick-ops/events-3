"use client";

import type { EmailAttachment } from "@/lib/types";

function fmtSize(n: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function icon(contentType: string) {
  if (contentType.startsWith("image/")) return "🖼";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("sheet") || contentType.includes("csv") || contentType.includes("excel")) return "📊";
  return "📎";
}

// Incoming/outgoing email attachments with view (inline) + download actions.
export function AttachmentList({
  attachments,
  className = "",
}: {
  attachments: EmailAttachment[];
  className?: string;
}) {
  const visible = attachments.filter((a) => !a.isInline);
  if (visible.length === 0) return null;
  return (
    <div className={className}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {visible.length} attachment{visible.length > 1 ? "s" : ""}
      </div>
      <ul className="space-y-1.5">
        {visible.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-base bg-surface-2 px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
              <span aria-hidden>{icon(a.contentType)}</span>
              <span className="truncate">{a.filename}</span>
              {a.size ? <span className="shrink-0 text-xs text-ink-muted">· {fmtSize(a.size)}</span> : null}
            </span>
            <span className="flex shrink-0 gap-3 text-xs">
              <a
                href={`/api/inbox/attachments/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline dark:text-brand-300"
              >
                View
              </a>
              <a
                href={`/api/inbox/attachments/${a.id}?download=1`}
                className="text-brand-600 hover:underline dark:text-brand-300"
              >
                Download
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
