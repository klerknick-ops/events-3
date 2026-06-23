import { ok, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { can, PERMISSIONS, type Permission } from "@/lib/permissions";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return ok({ user: null, permissions: {} });
  const permissions = Object.fromEntries(
    PERMISSIONS.map((p) => [p, can(user.role, p)]),
  ) as Record<Permission, boolean>;
  return ok({ user, permissions });
});
