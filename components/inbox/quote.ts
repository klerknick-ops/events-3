import type { EmailMessage } from "@/lib/types";

export interface ComposePreset {
  to?: string;
  subject?: string;
  body?: string;
  eventId?: string | null;
}

function quotedHeader(m: EmailMessage): string {
  const when = new Date(m.receivedAt).toLocaleString();
  const from = m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress;
  return `On ${when}, ${from} wrote:`;
}

// Wrap the original message as a quoted block under a blank line for the reply.
function quotedBody(m: EmailMessage): string {
  const inner = m.bodyIsHtml ? m.body : `<p>${(m.body || "").replace(/\n/g, "<br>")}</p>`;
  return `<br><br><hr><p>${quotedHeader(m)}</p><blockquote style="margin:0 0 0 0.8em;padding-left:0.8em;border-left:3px solid #ccc">${inner}</blockquote>`;
}

const stripPrefix = (s: string) => s.replace(/^(re|fwd):\s*/i, "");

export function buildReply(m: EmailMessage): ComposePreset {
  return {
    to: m.direction === "INBOUND" ? m.fromAddress : m.toAddresses,
    subject: `Re: ${stripPrefix(m.subject)}`,
    body: quotedBody(m),
    eventId: m.eventId ?? null,
  };
}

export function buildForward(m: EmailMessage): ComposePreset {
  return {
    to: "",
    subject: `Fwd: ${stripPrefix(m.subject)}`,
    body: quotedBody(m),
    eventId: m.eventId ?? null,
  };
}
