import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashPasswordScrypt } from "@/lib/auth/password";
import { requireApiAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(10, "Password must be at least 10 characters").max(256),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid password" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const hash = await hashPasswordScrypt(parsed.data.password);
  return NextResponse.json(
    { hash },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
