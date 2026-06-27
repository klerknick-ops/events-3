"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMe } from "./MeProvider";
import { useTheme } from "./ThemeProvider";
import { LanternLogo } from "./LanternLogo";
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
  { href: "/inbox", label: "Inbox", perm: "VIEW_GLOBAL_ACTIVITY" },
  { href: "/reports", label: "Reports", perm: "VIEW_GLOBAL_ACTIVITY" },
  { href: "/activity", label: "Activity", perm: "VIEW_GLOBAL_ACTIVITY" },
];

export function TopNav() {
  const pathname = usePathname();
  const { user, permissions, organizationName } = useMe();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // No chrome on the login screen. (Hooks above run unconditionally.)
  if (pathname === "/login" || !user) return null;

  const isPlatform = user.isPlatformAdmin && !user.organizationId;

  const navLinks = isPlatform
    ? [{ href: "/platform", label: "Organizations", exact: false }]
    : LINKS.filter((l) => !l.perm || permissions[l.perm]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-base bg-surface/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-3 sm:px-4">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-muted hover:text-ink md:hidden"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <Link
          href={isPlatform ? "/platform" : "/"}
          className="mr-2 flex items-center gap-2 md:mr-4"
        >
          <LanternLogo height={26} />
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">
            Lantern
          </span>
          {isPlatform ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Platform
            </span>
          ) : organizationName ? (
            <span className="hidden text-xs text-ink-muted lg:inline">· {organizationName}</span>
          ) : null}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(l.href, l.exact)
                  ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
                  : "text-ink-muted hover:bg-muted hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={user.name} role={user.role} />
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen ? (
        <nav className="space-y-0.5 border-t border-base bg-surface px-2 py-2 md:hidden">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(l.href, l.exact)
                  ? "bg-accent text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
                  : "text-ink-soft hover:bg-muted hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
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
