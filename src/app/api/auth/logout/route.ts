import { NextResponse, type NextRequest } from "next/server";
import {
  clearSessionCookie,
  getServerSession,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!verifySameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Cross-origin logout request rejected." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const session = await getServerSession();
    if (session) {
      const repo = getRepository();
      await repo.revokeAuthSession(session.sessionId);
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
    clearSessionCookie(response);
    return response;
  } catch {
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
    clearSessionCookie(response);
    return response;
  }
}
