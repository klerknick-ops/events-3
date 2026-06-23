import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { GlobalActivity } from "@/components/GlobalActivity";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "VIEW_GLOBAL_ACTIVITY")) {
    redirect("/timeline");
  }
  return <GlobalActivity />;
}
