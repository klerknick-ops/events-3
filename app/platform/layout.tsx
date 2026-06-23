import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/");
  return <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>;
}
