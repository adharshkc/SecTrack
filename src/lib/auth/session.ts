import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/storage";
import type { StoredAuthSession } from "@/lib/storage/types";

export const SESSION_COOKIE_NAME = "cslt_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SINGLE_OWNER_DEFAULT_UID = "owner-primary";

export type ConfiguredAuthMode = "env_master_password";

export interface AuthSystemStatus {
  mode: ConfiguredAuthMode;
  storageProvider: "firestore" | "postgres";
  vaultInitialized: boolean;
  allowPublicRegistration: boolean;
  legacySha256CompatEnabled: boolean;
}

export async function getAuthSystemStatus(): Promise<AuthSystemStatus> {
  const repo = getRepository();
  const mode: ConfiguredAuthMode = "env_master_password";
  const configured = Boolean(
    process.env.APP_PASSWORD_HASH &&
      process.env.APP_SESSION_SECRET &&
      process.env.APP_SESSION_SECRET.length >= 24
  );

  return {
    mode,
    storageProvider: repo.providerName,
    vaultInitialized: configured,
    allowPublicRegistration: process.env.ALLOW_PUBLIC_REGISTRATION === "true",
    legacySha256CompatEnabled: process.env.ALLOW_LEGACY_SHA256_HASH === "true",
  };
}

async function resolveSessionSecret(): Promise<string> {
  if (process.env.APP_SESSION_SECRET && process.env.APP_SESSION_SECRET.length >= 24) {
    return process.env.APP_SESSION_SECRET;
  }
  throw new Error("APP_SESSION_SECRET must be configured with at least 24 characters.");
}

function signSessionId(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId, "utf8").digest("hex");
}

function verifySignatureConstantTime(
  sessionId: string,
  providedSigHex: string,
  secret: string
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(providedSigHex)) return false;
  const expectedHex = signSessionId(sessionId, secret);
  const a = Buffer.from(providedSigHex.toLowerCase(), "hex");
  const b = Buffer.from(expectedHex.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  csrfToken: string;
  authMethod: StoredAuthSession["authMethod"];
  expiresAt: string;
}

export async function createAuthenticatedSession(
  userId: string,
  authMethod: StoredAuthSession["authMethod"]
): Promise<{ cookieValue: string; session: ActiveSession }> {
  const repo = getRepository();
  const secret = await resolveSessionSecret();
  const sessionId = randomBytes(24).toString("hex");
  const csrfToken = randomBytes(24).toString("hex");
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_SECONDS * 1000
  ).toISOString();

  await repo.createAuthSession({
    id: sessionId,
    userId,
    csrfToken,
    authMethod,
    expiresAt,
    revokedAt: null,
    createdAt: now.toISOString(),
  });

  const signature = signSessionId(sessionId, secret);
  return {
    cookieValue: `${sessionId}.${signature}`,
    session: {
      sessionId,
      userId,
      csrfToken,
      authMethod,
      expiresAt,
    },
  };
}

export function attachSessionCookie(response: NextResponse, cookieValue: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function verifySessionCookieValue(
  rawCookie?: string | null
): Promise<ActiveSession | null> {
  if (!rawCookie) return null;
  const parts = rawCookie.split(".");
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  if (!sessionId || sessionId.length < 16) return null;

  const secret = await resolveSessionSecret();
  if (!verifySignatureConstantTime(sessionId, sig, secret)) {
    return null;
  }

  const repo = getRepository();
  const stored = await repo.getAuthSession(sessionId);
  if (!stored) return null;
  if (stored.revokedAt) return null;
  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return {
    sessionId: stored.id,
    userId: stored.userId,
    csrfToken: stored.csrfToken,
    authMethod: stored.authMethod,
    expiresAt: stored.expiresAt,
  };
}

export async function getServerSession(): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionCookieValue(raw);
}

/**
 * Validates same-origin headers against CSRF on state-changing requests.
 */
export function verifySameOriginRequest(request: NextRequest | Request): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Verifies authentication + CSRF protection for API Route Handlers.
 * - For state-changing HTTP methods (POST, PUT, PATCH, DELETE), enforces both
 *   Same-Origin header verification AND constant-time X-CSRF-Token verification.
 */
export async function requireApiAuth(
  request: NextRequest | Request
): Promise<
  | { ok: true; session: ActiveSession }
  | { ok: false; response: NextResponse }
> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  const rawValue = match
    ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1))
    : null;

  const session = await verifySessionCookieValue(rawValue);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized. Please sign in to continue." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const method = request.method.toUpperCase();
  const isMutation =
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE";

  if (isMutation) {
    if (!verifySameOriginRequest(request)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Cross-origin state-changing request rejected." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        ),
      };
    }

    const providedCsrf = request.headers.get("x-csrf-token") || "";
    const a = Buffer.from(providedCsrf, "utf8");
    const b = Buffer.from(session.csrfToken, "utf8");
    if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or missing CSRF token." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        ),
      };
    }
  }

  return { ok: true, session };
}

export function getHashedClientIpKey(
  request: NextRequest | Request,
  scope: string
): string {
  // Prefer the hosting platform's client-IP header. If unavailable, use the
  // last X-Forwarded-For hop, which is the address added by the trusted proxy.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = request.headers.get("x-real-ip")?.trim() ||
    (forwarded ? forwarded.split(",").at(-1)?.trim() : null) ||
    "unknown";
  const digest = createHash("sha256")
    .update(`${scope}:${ip}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `${scope}_${digest}`;
}
