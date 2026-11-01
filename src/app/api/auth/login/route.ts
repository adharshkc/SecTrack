import { NextResponse, type NextRequest } from "next/server";
import { verifyPasswordHash } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createAuthenticatedSession,
  getHashedClientIpKey,
  SINGLE_OWNER_DEFAULT_UID,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { getRepository, syncRoadmapForUser } from "@/lib/storage";
import { masterLoginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    if (!verifySameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Cross-origin sign-in request denied." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repo = getRepository();
    const rateKey = getHashedClientIpKey(request, "login");
    const rate = await repo.checkAndIncrementRateLimit(
      rateKey,
      MAX_LOGIN_ATTEMPTS,
      LOGIN_WINDOW_MS
    );

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed sign-in attempts. Try again in ${Math.ceil(
            rate.retryAfterSeconds / 60
          )} minute(s).`,
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = masterLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const expectedHash = process.env.APP_PASSWORD_HASH || null;
    const userId = SINGLE_OWNER_DEFAULT_UID;
    const authMethod = "master_password" as const;

    if (!expectedHash) {
      return NextResponse.json(
        { error: "Password login is not configured. Set APP_PASSWORD_HASH in the server environment." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const verification = await verifyPasswordHash(
      parsed.data.password,
      expectedHash
    );

    if (!verification.valid) {
      return NextResponse.json(
        {
          error:
            verification.errorReason ||
            "Invalid credentials. Access denied.",
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    await repo.resetRateLimit(rateKey);
    await syncRoadmapForUser(userId);

    const { cookieValue, session } = await createAuthenticatedSession(
      userId,
      authMethod
    );

    const response = NextResponse.json(
      {
        authenticated: true,
        userId: session.userId,
        csrfToken: session.csrfToken,
        usedLegacySha256: verification.usedLegacySha256,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
    attachSessionCookie(response, cookieValue);
    return response;
  } catch (error) {
    // Keep details in the server log for diagnosis; never expose them to clients.
    console.error(
      "[auth/login] Sign-in request failed:",
      error instanceof Error ? error.stack || error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Sign-in failed due to an unexpected server error." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
