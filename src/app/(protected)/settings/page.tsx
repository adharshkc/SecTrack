import { SettingsClient } from "@/components/settings-client";
import { getAuthSystemStatus } from "@/lib/auth/session";
import { requirePageAuth } from "@/lib/server-context";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { session, settings } = await requirePageAuth();
  const status = await getAuthSystemStatus();

  return (
    <SettingsClient
      csrfToken={session.csrfToken}
      settings={settings}
      authMode={status.mode}
      storageProvider={status.storageProvider}
    />
  );
}
