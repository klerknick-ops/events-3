import { requireUser, requirePermission, type SessionUser } from "./auth";
import { prisma } from "./db";
import type { Permission } from "./permissions";

export interface OrgContext {
  user: SessionUser;
  orgId: string;
}

function noOrg(): never {
  throw new Response(
    JSON.stringify({ error: "No organization context for this account" }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

// Require an authenticated user that belongs to an organization. Every
// tenant-scoped API route starts here and uses `orgId` in its queries.
export async function requireOrg(): Promise<OrgContext> {
  const user = await requireUser();
  if (!user.organizationId) noOrg();
  return { user, orgId: user.organizationId };
}

// Like requireOrg but also checks a permission within the org.
export async function requireOrgPermission(
  permission: Permission,
): Promise<OrgContext> {
  const user = await requirePermission(permission);
  if (!user.organizationId) noOrg();
  return { user, orgId: user.organizationId };
}

// Platform-level (cross-tenant) admin — provisions organizations.
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    throw new Response(JSON.stringify({ error: "Platform admin only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

// Load an event only if it belongs to the caller's org, else throw 404 (don't
// leak existence across tenants). Returns the event row.
export async function getEventInOrg(eventId: string, orgId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
  if (!event) {
    throw new Response(JSON.stringify({ error: "Event not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return event;
}

// Assert an event belongs to the org (throws 404 otherwise).
export async function assertEventInOrg(eventId: string, orgId: string): Promise<void> {
  await getEventInOrg(eventId, orgId);
}
