import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ConfigTabs } from "@/components/ConfigTabs";

export default async function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "MANAGE_CONFIG")) {
    redirect("/timeline");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Configuration</h1>
        <p className="text-sm text-ink-muted">
          Manage the reusable building blocks used across every event.
        </p>
      </div>
      <ConfigTabs />
      {children}
    </div>
  );
}
