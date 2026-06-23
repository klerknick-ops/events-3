"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { useMe } from "./MeProvider";
import { useTheme } from "./ThemeProvider";
import { ROLE_LABELS, type Permission, type Role } from "@/lib/permissions";

const LINKS: {
  href: string;
  label: string;
  exact?: boolean;
  perm?: Permission;
}[] = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/timeline", label: "Timeline" },
  { href: "/tasks", label: "Tasks" },
  { href: "/clients", label: "Clients" },
  { href: "/activity", label: "Activity", perm: "VIEW_GLOBAL_ACTIVITY" },
];

export function TopNav() {
  const pathname = usePathname();
  const { user, permissions, organizationName } = useMe();

  // No chrome on the login screen.
  if (pathname === "/login" || !user) return null;

  const isPlatform = user.isPlatformAdmin && !user.organizationId;

  return (
    <header className="sticky top-0 z-30 border-b border-base bg-surface/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-4">
        <Link href={isPlatform ? "/platform" : "/"} className="mr-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">
            Sir + Events
          </span>
          {isPlatform ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Platform
            </span>
          ) : organizationName ? (
            <span className="hidden text-xs text-ink-muted sm:inline">· {organizationName}</span>
          ) : null}
        </Link>
        {isPlatform ? (
          <nav className="flex items-center gap-1">
            <Link
              href="/platform"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
            >
              Organizations
            </Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-1">
            {LINKS.filter((l) => !l.perm || permissions[l.perm]).map((l) => {
            const active = l.exact
              ? pathname === l.href
              : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
                    : "text-ink-muted hover:bg-muted hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            );
          })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={user.name} role={user.role} />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-muted hover:text-ink"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-brand-700 dark:bg-brand-600/30 dark:text-brand-200">
          {initials}
        </span>
        <span className="hidden text-sm font-medium text-ink sm:block">{name}</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-xl border border-base bg-surface p-1 shadow-panel">
            <div className="px-3 py-2">
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-muted">
                {ROLE_LABELS[role as Role] ?? role}
              </div>
            </div>
            <div className="my-1 border-t border-base" />
            {role === "ADMIN" ? (
              <Link
                href="/config"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-muted"
              >
                Configuration
              </Link>
            ) : null}
            <button
              onClick={logout}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
