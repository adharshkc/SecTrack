import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";
import { updateSettingsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const repo = getRepository();
    const settings = await repo.getSettings(auth.session.userId);
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid settings update." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repo = getRepository();
    const settings = await repo.updateSettings(auth.session.userId, parsed.data);
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
