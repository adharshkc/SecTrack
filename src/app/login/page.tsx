import { redirect } from "next/navigation";
import { LoginClient } from "@/components/login-client";
import { getAuthSystemStatus, getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  const status = await getAuthSystemStatus();

  return (
    <LoginClient
      vaultInitialized={status.vaultInitialized}
      storageProvider={status.storageProvider}
      legacySha256CompatEnabled={status.legacySha256CompatEnabled}
    />
  );
}
