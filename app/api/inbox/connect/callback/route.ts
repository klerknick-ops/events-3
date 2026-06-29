import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MS_GRAPH_SETTING_KEY, getStoredConfig } from "@/lib/mail/graph";

// Redirect target for the Microsoft admin-consent flow. Microsoft sends the
// admin back here with ?admin_consent=True (or an error). We record consent on
// the org's connection and bounce to the config page. Register this exact URL
// as a Web redirect URI on the Entra app registration.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/config/inbox?${q}`);

  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.redirect(`${origin}/login`);
  if (!can(user.role, "MANAGE_CONFIG")) return back("consent=error&desc=Not%20authorised");

  const orgId = user.organizationId;
  const adminConsent = (url.searchParams.get("admin_consent") || "").toLowerCase();
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

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

  return back(`consent=error&desc=${encodeURIComponent(errorDesc || error || "Consent not granted")}`);
}
