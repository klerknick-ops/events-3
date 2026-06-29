"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";

interface Connection {
  tenantId: string;
  clientId: string;
  mailbox: string;
  hasSecret: boolean;
  consentedAt: string | null;
  configured: boolean;
  mode: "delegated" | "app" | "env" | null;
  connectedUserEmail: string | null;
  connectedUserName: string | null;
  connectedAt: string | null;
}

export default function InboxConnectionPage() {
  const [conn, setConn] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [mailbox, setMailbox] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [origin, setOrigin] = useState("");

  async function load() {
    const c = await api.get<Connection>("/api/inbox/connection");
    setConn(c);
    setTenantId(c.tenantId);
    setClientId(c.clientId);
    setMailbox(c.mailbox);
    setClientSecret("");
    setDirty(false);
    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    // Surface the consent redirect result.
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) setBanner({ kind: "ok", text: `Connected as ${decodeURIComponent(p.get("connected")!)}.` });
    else if (p.get("consent") === "ok") setBanner({ kind: "ok", text: "Admin consent granted — the app can now access the mailbox." });
    else if (p.get("consent") === "error") setBanner({ kind: "err", text: "Failed: " + (p.get("desc") || "unknown error") });
    if (p.get("consent") || p.get("connected")) window.history.replaceState({}, "", "/config/inbox");
    load();
  }, []);

  const redirectUri = origin ? `${origin}/api/inbox/connect/callback` : "";

  async function save() {
    setSaving(true);
    setBanner(null);
    try {
      await api.put("/api/inbox/connection", {
        tenantId: tenantId.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret || undefined, // blank keeps existing
        mailbox: mailbox.trim(),
      });
      await load();
      setBanner({ kind: "ok", text: "Saved." });
    } catch (e) {
      setBanner({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function grantConsent() {
    const url =
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId.trim())}/v2.0/adminconsent` +
      `?client_id=${encodeURIComponent(clientId.trim())}` +
      `&scope=${encodeURIComponent("https://graph.microsoft.com/.default")}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = url;
  }

  async function test() {
    setTestResult(null);
    const r = await api.post<{ ok: boolean; mailbox?: string; error?: string }>("/api/inbox/connection/test");
    setTestResult({ ok: r.ok, text: r.ok ? `Connected to ${r.mailbox}.` : r.error || "Failed." });
  }

  async function disconnect() {
    if (!confirm("Disconnect the Microsoft 365 sign-in? The inbox will stop syncing until reconnected.")) return;
    await api.del("/api/inbox/connection");
    await load();
    setBanner({ kind: "ok", text: "Disconnected." });
  }

  if (loading || !conn) {
    return (
      <div className="flex justify-center py-12 text-ink-muted">
        <Spinner />
      </div>
    );
  }

  const canConsent = tenantId.trim() && clientId.trim() && conn.hasSecret && !dirty;

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-ink-muted">
        Connect the mailbox via Microsoft 365. Enter the Azure app registration details, <b>Save</b>,
        then <b>Sign in with Microsoft</b> as the admin who owns the mailbox — the connection is tied
        to that admin account. (An app-only alternative is available below.)
      </p>

      {banner ? (
        <div
          className={
            "rounded-lg border p-3 text-sm " +
            (banner.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300")
          }
        >
          {banner.text}
        </div>
      ) : null}

      {/* Status */}
      <Card className="p-4">
        {(() => {
          const ready = conn.mode === "delegated" || conn.mode === "env" || (conn.mode === "app" && conn.consentedAt);
          let label: string;
          if (conn.mode === "delegated")
            label = `Connected as ${conn.connectedUserName || conn.connectedUserEmail || "admin"}`;
          else if (conn.mode === "env") label = "Connected (server env)";
          else if (conn.mode === "app" && conn.consentedAt) label = "Connected (app-only)";
          else if (conn.mode === "app") label = "Configured — grant admin consent to finish";
          else label = "Not connected (Inbox runs in demo mode)";
          return (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={"inline-block h-2.5 w-2.5 rounded-full " + (ready ? "bg-emerald-500" : conn.configured ? "bg-amber-500" : "bg-ink-muted")} />
              <span className="font-medium text-ink">{label}</span>
              {conn.mailbox ? <span className="text-xs text-ink-muted">· mailbox: {conn.mailbox}</span> : null}
              {conn.connectedAt ? <span className="text-xs text-ink-muted">· {new Date(conn.connectedAt).toLocaleDateString()}</span> : null}
            </div>
          );
        })()}
      </Card>

      {/* Redirect URI to register */}
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Redirect URI (add this to the Entra app → Authentication → Web)
        </div>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-ink">{redirectUri}</code>
          <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(redirectUri)}>
            Copy
          </Button>
        </div>
      </Card>

      {/* Credentials */}
      <Card className="space-y-4 p-4">
        <Field label="Directory (tenant) ID">
          <Input value={tenantId} onChange={(e) => { setTenantId(e.target.value); setDirty(true); }} placeholder="00000000-0000-0000-0000-000000000000" />
        </Field>
        <Field label="Application (client) ID">
          <Input value={clientId} onChange={(e) => { setClientId(e.target.value); setDirty(true); }} placeholder="00000000-0000-0000-0000-000000000000" />
        </Field>
        <Field label="Client secret" hint={conn.hasSecret ? "A secret is stored. Leave blank to keep it." : "Paste the secret Value from Certificates & secrets."}>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => { setClientSecret(e.target.value); setDirty(true); }}
            placeholder={conn.hasSecret ? "•••••••• (unchanged)" : ""}
          />
        </Field>
        <Field label="Shared mailbox address">
          <Input value={mailbox} onChange={(e) => { setMailbox(e.target.value); setDirty(true); }} placeholder="events@yourdomain.com" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {/* Primary: connect as the signed-in admin (delegated) */}
          <Button
            onClick={() => (window.location.href = "/api/inbox/connect/login")}
            disabled={!canConsent}
            title={!canConsent ? "Save tenant, client ID and secret first" : ""}
          >
            {conn.mode === "delegated" ? "Re-connect Microsoft" : "Sign in with Microsoft"}
          </Button>
          {conn.mode === "delegated" ? (
            <Button variant="danger" onClick={disconnect}>
              Disconnect
            </Button>
          ) : null}
          <Button variant="secondary" onClick={test} disabled={!conn.configured || dirty}>
            Test connection
          </Button>
        </div>
        {dirty ? <p className="text-xs text-ink-muted">Save your changes before signing in or testing.</p> : null}

        {/* Alternative: app-only admin consent (not tied to a person) */}
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer">Alternative: connect app-only (not tied to an admin)</summary>
          <p className="mt-1">
            Uses application permissions + admin consent instead of a personal sign-in. Survives
            staff changes but ignores per-user mailbox access.
          </p>
          <Button className="mt-2" size="sm" variant="secondary" onClick={grantConsent} disabled={!canConsent}>
            Grant admin consent (app-only)
          </Button>
        </details>
        {testResult ? (
          <p className={"text-sm " + (testResult.ok ? "text-emerald-600" : "text-rose-600")}>
            {testResult.ok ? "✓ " : "✕ "}
            {testResult.text}
          </p>
        ) : null}
      </Card>

      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer font-medium text-ink">Setup steps (Microsoft Entra)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Entra admin center → App registrations → New registration (single tenant).</li>
          <li>Copy the Directory (tenant) ID and Application (client) ID into the fields above.</li>
          <li>API permissions → Microsoft Graph → add <b>Delegated</b> Mail.Read, Mail.Send, Mail.ReadWrite (for admin sign-in). For the app-only alternative also add the same as <b>Application</b> permissions + grant admin consent.</li>
          <li>Authentication → add the Redirect URI shown above (type: Web).</li>
          <li>Certificates &amp; secrets → New client secret → paste its Value above. Save.</li>
          <li>Click “Sign in with Microsoft”, then “Test connection”.</li>
          <li>The mailbox can be the admin&rsquo;s own address, or a shared mailbox the admin has full access to.</li>
        </ol>
      </details>
    </div>
  );
}
