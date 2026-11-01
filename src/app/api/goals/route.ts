import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";
import type { Goal, GoalPeriodType } from "@/lib/types";
import { upsertGoalSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const periodType = url.searchParams.get("periodType") as GoalPeriodType | null;
    const periodKey = url.searchParams.get("periodKey");

    const repo = getRepository();
    if (periodType && periodKey) {
      const goal = await repo.getGoal(auth.session.userId, periodType, periodKey);
      return NextResponse.json(
        { goal },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const goals = await repo.listGoals(auth.session.userId);
    return NextResponse.json(
      { goals },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load goals." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = upsertGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid goal input." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = parsed.data;
    const repo = getRepository();
    const existing = await repo.getGoal(
      auth.session.userId,
      data.periodType,
      data.periodKey
    );
    const nowIso = new Date().toISOString();

    const goal: Goal = {
      id: `${data.periodType}_${data.periodKey}`,
      periodType: data.periodType,
      periodKey: data.periodKey,
      targetMinutes: data.targetMinutes,
      targetCompletedTopics: data.targetCompletedTopics ?? 0,
      targetCompletedLabs: data.targetCompletedLabs ?? 0,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    const saved = await repo.upsertGoal(auth.session.userId, goal);

    // Also keep default user settings targets aligned for convenient future periods
    if (data.periodType === "daily") {
      await repo.updateSettings(auth.session.userId, {
        dailyTargetMinutes: data.targetMinutes,
      });
    } else if (data.periodType === "weekly") {
      await repo.updateSettings(auth.session.userId, {
        weeklyTargetMinutes: data.targetMinutes,
      });
    } else if (data.periodType === "monthly") {
      await repo.updateSettings(auth.session.userId, {
        monthlyTargetMinutes: data.targetMinutes,
        monthlyTargetTopics: data.targetCompletedTopics,
        monthlyTargetLabs: data.targetCompletedLabs,
      });
    }

    return NextResponse.json(
      { goal: saved },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to save goal." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
