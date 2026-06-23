import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./db";
import { can, type Permission } from "./permissions";
import { SESSION_COOKIE } from "./auth-constants";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

// Re-exported so existing imports from "@/lib/auth" keep working.
export { hashPassword, verifyPassword } from "./password";

// ---------- Sessions ----------

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    jar.delete(SESSION_COOKIE);
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
}

// Resolve the signed-in user from the session cookie. Works in both Server
// Components and Route Handlers (both have access to next/headers cookies()).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }
  const { id, email, name, role, organizationId, isPlatformAdmin } = session.user;
  return { id, email, name, role, organizationId, isPlatformAdmin };
}

// For API routes: returns the user or throws a Response (handled by `route`).
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new Response(
      JSON.stringify({ error: "You don't have permission to do that" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  return user;
}
