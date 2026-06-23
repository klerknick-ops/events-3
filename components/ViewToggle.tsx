"use client";

import Link from "next/link";
import clsx from "clsx";

// Segmented control to switch between Day timeline, Week timeline and Month
// calendar. All three read from the same event data — this just routes.
export function ViewToggle({
  active,
  date,
}: {
  active: "day" | "week" | "month";
  date?: string; // YYYY-MM-DD to carry across views
}) {
  const q = date ? `?date=${date}` : "";
  return (
    <div className="flex rounded-lg border border-base bg-surface p-0.5">
      <Tab href={`/timeline${q}`} label="Day" on={active === "day"} />
      <Tab
        href={`/timeline?view=week${date ? `&date=${date}` : ""}`}
        label="Week"
        on={active === "week"}
      />
      <Tab href={`/calendar${q}`} label="Month" on={active === "month"} />
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
