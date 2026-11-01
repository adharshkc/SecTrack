import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";
import type { Reflection, ReflectionPeriodType } from "@/lib/types";
import { upsertReflectionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const periodType = url.searchParams.get(
      "periodType"
    ) as ReflectionPeriodType | null;
    const periodKey = url.searchParams.get("periodKey");

    const repo = getRepository();
    if (periodType && periodKey) {
      const reflection = await repo.getReflection(
        auth.session.userId,
        periodType,
        periodKey
      );
      return NextResponse.json(
        { reflection },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const reflections = await repo.listReflections(auth.session.userId);
    return NextResponse.json(
      { reflections },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load reflections." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = upsertReflectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reflection input." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = parsed.data;
    const repo = getRepository();
    const existing = await repo.getReflection(
      auth.session.userId,
      data.periodType,
      data.periodKey
    );
    const nowIso = new Date().toISOString();

    const reflection: Reflection = {
      id: `${data.periodType}_${data.periodKey}`,
      periodType: data.periodType,
      periodKey: data.periodKey,
      learned: data.learned,
      achievements: data.achievements,
      challenges: data.challenges,
      revisionItems: data.revisionItems,
      nextPriorities: data.nextPriorities,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    const saved = await repo.upsertReflection(auth.session.userId, reflection);
    return NextResponse.json(
      { reflection: saved },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to save reflection." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
