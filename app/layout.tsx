import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { MeProvider, type Me } from "@/components/MeProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { themeInitScript } from "@/lib/theme-script";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can, PERMISSIONS, type Permission } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Lantern — Event Planning",
  description:
    "Plan and manage events in bookable spaces. Timeline-first booking for restaurants & hotels.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const organization = user?.organizationId
    ? await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { name: true },
      })
    : null;
  const me: Me = {
    user,
    organizationName: organization?.name ?? null,
    permissions: user
      ? (Object.fromEntries(
          PERMISSIONS.map((p) => [p, can(user.role, p)]),
        ) as Record<Permission, boolean>)
      : {},
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <MeProvider value={me}>
            <div className="flex min-h-screen flex-col">
              <TopNav />
              <main className="flex-1">{children}</main>
            </div>
          </MeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
