// ---------------------------------------------------------------------------
// Microsoft 365 / Outlook integration via Microsoft Graph.
//
// This is a thin service layer behind a clean interface so real Azure AD
// credentials can be dropped in (env vars) without touching the rest of the app.
// When credentials are absent the layer reports "not configured" and the inbox
// falls back to a local demo dataset (see lib/mail/sync.ts), so the feature is
// fully usable in development.
//
// REAL SETUP REQUIRED (outside what this code can do for you):
//   1. Register an app in Azure AD (Entra ID).
//   2. Grant the application Microsoft Graph permission `Mail.ReadWrite` and
//      `Mail.Send` (Application permissions) and admin-consent them.
//   3. Create a client secret.
//   4. Set these env vars on the server:
//        MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET,
//        MS_GRAPH_MAILBOX   (the business mailbox UPN / address to send+receive)
// ---------------------------------------------------------------------------

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
}

export interface IncomingMessage {
  graphId: string;
  conversationId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string;
  subject: string;
  bodyPreview: string;
  body: string;
  bodyIsHtml: boolean;
  receivedAt: string; // ISO
}

export interface SendMessageInput {
  to: string[];
  subject: string;
  body: string; // HTML
}

export function getGraphConfig(): GraphConfig | null {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const mailbox = process.env.MS_GRAPH_MAILBOX;
  if (tenantId && clientId && clientSecret && mailbox) {
    return { tenantId, clientId, clientSecret, mailbox };
  }
  return null;
}

export function isGraphConfigured(): boolean {
  return getGraphConfig() !== null;
}

// The mailbox address to show in the UI (or a placeholder in demo mode).
export function configuredMailbox(): string | null {
  return getGraphConfig()?.mailbox ?? null;
}

// Client-credentials OAuth token for the app (no signed-in user).
async function getAccessToken(cfg: GraphConfig): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
}

// Fetch the most recent messages from the configured mailbox. Returns [] when
// not configured (callers fall back to the demo dataset).
export async function fetchInbox(limit = 25): Promise<IncomingMessage[]> {
  const cfg = getGraphConfig();
  if (!cfg) return [];
  const token = await getAccessToken(cfg);
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}/messages` +
    `?$top=${limit}&$orderby=receivedDateTime desc` +
    `&$select=id,conversationId,subject,bodyPreview,body,receivedDateTime,from,toRecipients`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Graph fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { value: GraphMessage[] };
  return json.value.map((m) => ({
    graphId: m.id,
    conversationId: m.conversationId ?? null,
    fromAddress: m.from?.emailAddress?.address?.toLowerCase() ?? "",
    fromName: m.from?.emailAddress?.name ?? null,
    toAddresses: (m.toRecipients ?? [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(", "),
    subject: m.subject ?? "(no subject)",
    bodyPreview: m.bodyPreview ?? "",
    body: m.body?.content ?? m.bodyPreview ?? "",
    bodyIsHtml: (m.body?.contentType ?? "html").toLowerCase() === "html",
    receivedAt: m.receivedDateTime ?? new Date().toISOString(),
  }));
}

// Send an email through the configured mailbox. In demo mode (no credentials)
// this is a no-op that logs, so compose still works locally.
export async function sendMail(input: SendMessageInput): Promise<{ sent: boolean }> {
  const cfg = getGraphConfig();
  if (!cfg) {
    console.log("[mail] (demo, not sent) →", input.to.join(", "), "·", input.subject);
    return { sent: false };
  }
  const token = await getAccessToken(cfg);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "HTML", content: input.body },
          toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Graph sendMail failed: ${res.status} ${await res.text()}`);
  }
  return { sent: true };
}
