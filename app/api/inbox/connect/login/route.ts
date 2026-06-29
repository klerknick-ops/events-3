import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { DELEGATED_SCOPES, getStoredConfig } from "@/lib/mail/graph";

// Start the delegated "Sign in with Microsoft" flow: redirect the admin to the
// Microsoft authorize endpoint. They sign in + consent, and Microsoft returns
// to /api/inbox/connect/callback with an authorization code.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.redirect(`${origin}/login`);
  if (!can(user.role, "MANAGE_CONFIG")) {
    return NextResponse.redirect(`${origin}/config/inbox?consent=error&desc=Not%20authorised`);
  }
  const s = await getStoredConfig(user.organizationId);
  if (!s?.tenantId || !s.clientId || !s.clientSecret) {
    return NextResponse.redirect(`${origin}/config/inbox?consent=error&desc=Save%20tenant%2C%20client%20ID%20and%20secret%20first`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/inbox/connect/callback`;
  const authorize =
    `https://login.microsoftonline.com/${encodeURIComponent(s.tenantId)}/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(s.clientId)}` +
    `&response_type=code&response_mode=query` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(DELEGATED_SCOPES)}` +
    `&state=${state}&prompt=select_account`;

  const res = NextResponse.redirect(authorize);
  res.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
