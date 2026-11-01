import { NextResponse } from "next/server";
import { getAuthSystemStatus, getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [status, session] = await Promise.all([
      getAuthSystemStatus(),
      getServerSession(),
    ]);

    return NextResponse.json(
      {
        mode: status.mode,
        storageProvider: status.storageProvider,
        vaultInitialized: status.vaultInitialized,
        allowPublicRegistration: status.allowPublicRegistration,
        legacySha256CompatEnabled: status.legacySha256CompatEnabled,
        authenticated: Boolean(session),
        userId: session?.userId ?? null,
        csrfToken: session?.csrfToken ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load authentication status." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
