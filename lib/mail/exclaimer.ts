// ---------------------------------------------------------------------------
// Exclaimer email-signature integration (best-effort).
//
// Reality check on Exclaimer's integration surface: Exclaimer primarily applies
// signatures *server-side* at the mail-transport level (a connector in Exchange
// Online stamps outbound mail as it leaves the tenant). It also offers an
// Outlook add-in that can render signatures in the compose window, but there is
// no universal, un-authenticated public REST endpoint that simply returns "my
// signature HTML" — that requires tenant-specific Exclaimer Cloud API setup.
//
// So this is implemented as best-effort with a graceful fallback chain:
//   1. EXCLAIMER_SIGNATURE_API_URL  → fetch signature HTML from your Exclaimer
//      Cloud endpoint (optionally with EXCLAIMER_API_TOKEN as a bearer token).
//   2. EXCLAIMER_SIGNATURE_HTML     → a static signature snippet (use {{name}},
//      {{email}}, {{org}} placeholders).
//   3. A generated default signature from the sender's name + organization.
//
// In all cases, note that if Exclaimer's transport rule is active, it will also
// stamp the *final* signature on send — what we insert here is a preview/
// approximation for the composer.
// ---------------------------------------------------------------------------

export type SignatureSource = "exclaimer-api" | "static" | "generated";

export interface ResolvedSignature {
  html: string;
  source: SignatureSource;
  // Human-readable caveat surfaced in the UI.
  note: string;
}

interface SignatureContext {
  userName: string;
  userEmail: string;
  orgName: string;
}

function fillPlaceholders(tpl: string, ctx: SignatureContext): string {
  return tpl
    .replaceAll("{{name}}", ctx.userName)
    .replaceAll("{{email}}", ctx.userEmail)
    .replaceAll("{{org}}", ctx.orgName);
}

export async function getSignature(ctx: SignatureContext): Promise<ResolvedSignature> {
  // 1. Exclaimer Cloud API (if configured).
  const apiUrl = process.env.EXCLAIMER_SIGNATURE_API_URL;
  if (apiUrl) {
    try {
      const token = process.env.EXCLAIMER_API_TOKEN;
      const res = await fetch(
        `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}user=${encodeURIComponent(ctx.userEmail)}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      if (res.ok) {
        const html = (await res.text())?.trim();
        if (html) {
          return {
            html,
            source: "exclaimer-api",
            note: "Loaded from Exclaimer. Exclaimer's transport rule may re-stamp the final signature on send.",
          };
        }
      }
    } catch {
      /* fall through to static / generated */
    }
  }

  // 2. Static snippet from env.
  const staticHtml = process.env.EXCLAIMER_SIGNATURE_HTML;
  if (staticHtml && staticHtml.trim()) {
    return {
      html: fillPlaceholders(staticHtml, ctx),
      source: "static",
      note: "Using the configured static signature (Exclaimer API not connected).",
    };
  }

  // 3. Generated default.
  return {
    html: generatedSignature(ctx),
    source: "generated",
    note: "Generated placeholder signature. Connect Exclaimer (EXCLAIMER_SIGNATURE_API_URL) for the real one.",
  };
}

function generatedSignature(ctx: SignatureContext): string {
  return [
    `<br/><br/>`,
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;border-top:2px solid #4f46e5;padding-top:8px;margin-top:8px;">`,
    `<strong>${escapeHtml(ctx.userName)}</strong><br/>`,
    `${escapeHtml(ctx.orgName)}<br/>`,
    `<a href="mailto:${escapeHtml(ctx.userEmail)}" style="color:#4f46e5;">${escapeHtml(ctx.userEmail)}</a>`,
    `</div>`,
  ].join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
