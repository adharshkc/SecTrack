import { NextResponse, type NextRequest } from "next/server";
import {
  calculateDailySummary,
  calculateMonthlyReport,
  calculatePhaseProgress,
  calculateRoadmapCompletion,
  calculateStreaks,
  calculateWeeklyReport,
  getEligiblePrimaryTopics,
} from "@/lib/analytics";
import { requireApiAuth } from "@/lib/auth/session";
import {
  addDaysToDateKey,
  getTodayDateKey,
  getWeekRangeForDateKey,
  isValidDateKey,
  isValidMonthKey,
} from "@/lib/dates";
import { ROADMAP_PHASES } from "@/lib/roadmap-data";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const repo = getRepository();
    const settings = await repo.getSettings(auth.session.userId);
    const todayKey = getTodayDateKey(settings.timezone);

    const url = new URL(request.url);
    const dateKey = url.searchParams.get("dateKey") || todayKey;
    const monthKey = url.searchParams.get("monthKey") || todayKey.slice(0, 7);

    if (!isValidDateKey(dateKey) || !isValidMonthKey(monthKey)) {
      return NextResponse.json(
        { error: "Invalid dateKey or monthKey query parameter." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const [topics, sessions, completionEvents] = await Promise.all([
      repo.listTopics(auth.session.userId),
      repo.listSessions(auth.session.userId),
      repo.listCompletionEvents(auth.session.userId),
    ]);

    const weekRange = getWeekRangeForDateKey(dateKey);
    const prevWeekRange = getWeekRangeForDateKey(
      addDaysToDateKey(weekRange.weekStart, -7)
    );

    const [dailyGoal, weeklyGoal, monthlyGoal] = await Promise.all([
      repo.getGoal(auth.session.userId, "daily", dateKey),
      repo.getGoal(auth.session.userId, "weekly", weekRange.weekStart),
      repo.getGoal(auth.session.userId, "monthly", monthKey),
    ]);

    const dailyTarget = dailyGoal?.targetMinutes ?? settings.dailyTargetMinutes;
    const weeklyTarget = weeklyGoal?.targetMinutes ?? settings.weeklyTargetMinutes;
    const monthlyTargetMins =
      monthlyGoal?.targetMinutes ?? settings.monthlyTargetMinutes;
    const monthlyTargetTopics =
      monthlyGoal?.targetCompletedTopics ?? settings.monthlyTargetTopics;
    const monthlyTargetLabs =
      monthlyGoal?.targetCompletedLabs ?? settings.monthlyTargetLabs;

    const eligibleIds = new Set(getEligiblePrimaryTopics(topics).map((t) => t.id));
    const overall = calculateRoadmapCompletion(topics);
    const phaseProgress = calculatePhaseProgress(ROADMAP_PHASES, topics);
    const streaks = calculateStreaks(sessions, todayKey);
    const daily = calculateDailySummary(
      dateKey,
      sessions,
      completionEvents,
      dailyTarget,
      settings.timezone,
      eligibleIds
    );
    const weekly = calculateWeeklyReport({
      referenceDateKey: dateKey,
      sessions: sessions.filter(
        (s) => s.dateKey >= weekRange.weekStart && s.dateKey <= weekRange.weekEnd
      ),
      previousWeekSessions: sessions.filter(
        (s) =>
          s.dateKey >= prevWeekRange.weekStart &&
          s.dateKey <= prevWeekRange.weekEnd
      ),
      completionEvents,
      topics,
      weeklyTargetMinutes: weeklyTarget,
      dailyTargetMinutes: settings.dailyTargetMinutes,
      timezone: settings.timezone,
    });
    const monthly = calculateMonthlyReport({
      monthKey,
      sessions,
      completionEvents,
      topics,
      phases: ROADMAP_PHASES,
      targetMinutes: monthlyTargetMins,
      targetTopics: monthlyTargetTopics,
      targetLabs: monthlyTargetLabs,
      dailyTargetMinutes: settings.dailyTargetMinutes,
      timezone: settings.timezone,
    });

    return NextResponse.json(
      {
        todayKey,
        overall,
        phaseProgress,
        streaks,
        daily,
        weekly,
        monthly,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to compute progress summary." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
