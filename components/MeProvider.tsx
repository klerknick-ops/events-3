"use client";

import { createContext, useContext } from "react";
import type { Permission } from "@/lib/permissions";

export interface Me {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string | null;
    isPlatformAdmin: boolean;
  } | null;
  organizationName: string | null;
  permissions: Partial<Record<Permission, boolean>>;
}

const MeContext = createContext<Me>({
  user: null,
  organizationName: null,
  permissions: {},
});

export function MeProvider({ value, children }: { value: Me; children: React.ReactNode }) {
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  return useContext(MeContext);
}

export function useCan(permission: Permission): boolean {
  const { permissions } = useMe();
  return Boolean(permissions[permission]);
}
