"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useMe } from "./MeProvider";

const TABS: { href: string; label: string; perm?: "MANAGE_USERS" }[] = [
  { href: "/config/spaces", label: "Bookable Spaces" },
  { href: "/config/products", label: "Products" },
  { href: "/config/rooms", label: "Hotel Rooms" },
  { href: "/config/templates", label: "Event Templates" },
  { href: "/config/task-templates", label: "Task Rules" },
  { href: "/config/notification-rules", label: "Notification Rules" },
  { href: "/config/sheet-templates", label: "Document Templates" },
  { href: "/config/email-signature", label: "Email Signature" },
  { href: "/config/policy", label: "Cancellation Policy" },
  { href: "/config/payment-terms", label: "Payment Terms" },
  { href: "/config/budgets", label: "Budgets" },
  { href: "/config/users", label: "Users", perm: "MANAGE_USERS" },
];

export function ConfigTabs() {
  const pathname = usePathname();
  const { permissions } = useMe();
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-base">
      {TABS.filter((t) => !t.perm || permissions[t.perm]).map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand-600 text-brand-700 dark:text-brand-300"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
