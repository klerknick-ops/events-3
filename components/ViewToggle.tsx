"use client";

import Link from "next/link";
import clsx from "clsx";

// Segmented control to switch between the Day Timeline and Month Calendar.
// Both views read from the same event data — this just routes between them.
export function ViewToggle({
  active,
  date,
}: {
  active: "day" | "month";
  date?: string; // YYYY-MM-DD to carry across views
}) {
  const dayHref = date ? `/timeline?date=${date}` : "/timeline";
  const monthHref = date ? `/calendar?date=${date}` : "/calendar";
  return (
    <div className="flex rounded-lg border border-base bg-surface p-0.5">
      <Tab href={dayHref} label="Day" on={active === "day"} />
      <Tab href={monthHref} label="Month" on={active === "month"} />
    </div>
  );
}

function Tab({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        on
          ? "bg-brand-600 text-white"
          : "text-ink-muted hover:bg-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}
