import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requirePageAuth } from "@/lib/server-context";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, settings, storageProvider } = await requirePageAuth();

  return (
    <AppShell
      csrfToken={session.csrfToken}
      initialTheme={settings.theme}
      timezone={settings.timezone}
      storageProvider={storageProvider}
    >
      {children}
    </AppShell>
  );
}
