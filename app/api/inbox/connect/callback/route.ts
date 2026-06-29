import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MS_GRAPH_SETTING_KEY, getStoredConfig, completeDelegatedSignin } from "@/lib/mail/graph";

// Redirect target for BOTH Microsoft flows on this app:
//  - delegated sign-in  → returns ?code=...   → exchange for tokens (admin-tied)
//  - app-only consent   → returns ?admin_consent=True
// Register this exact URL as a Web redirect URI on the Entra app registration.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/config/inbox?${q}`);

  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.redirect(`${origin}/login`);
  if (!can(user.role, "MANAGE_CONFIG")) return back("consent=error&desc=Not%20authorised");
  const orgId = user.organizationId;

  const code = url.searchParams.get("code");
  const adminConsent = (url.searchParams.get("admin_consent") || "").toLowerCase();
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  // --- Delegated sign-in (admin-tied) ---
  if (code) {
    const jar = await cookies();
    const expected = jar.get("ms_oauth_state")?.value;
    const state = url.searchParams.get("state");
    if (!expected || expected !== state) return back("consent=error&desc=Invalid%20state");
    try {
      const { name, email } = await completeDelegatedSignin(orgId, code, `${origin}/api/inbox/connect/callback`);
      const who = encodeURIComponent(name || email || "admin");
      const res = back(`connected=${who}`);
      res.cookies.delete("ms_oauth_state");
      return res;
    } catch (e) {
      return back(`consent=error&desc=${encodeURIComponent((e as Error).message)}`);
    }
  }

  // --- App-only admin consent ---
  if (adminConsent === "true") {
    const existing = (await getStoredConfig(orgId)) ?? {};
    const merged = { ...existing, consentedAt: new Date().toISOString() };
    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId: orgId, key: MS_GRAPH_SETTING_KEY } },
      create: { organizationId: orgId, key: MS_GRAPH_SETTING_KEY, value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });
    return back("consent=ok");
  }

  return back(`consent=error&desc=${encodeURIComponent(errorDesc || error || "No code or consent returned")}`);
}
