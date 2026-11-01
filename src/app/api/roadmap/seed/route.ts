import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { syncRoadmapForUser } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await syncRoadmapForUser(auth.session.userId, { force: true });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to synchronize canonical roadmap." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
