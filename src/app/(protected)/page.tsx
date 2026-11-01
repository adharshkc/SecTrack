import { DashboardClient } from "@/components/dashboard-client";
import {
  calculateDailySummary,
  calculatePhaseProgress,
  calculateRoadmapCompletion,
  calculateStreaks,
  getEligiblePrimaryTopics,
  getValidSessions,
} from "@/lib/analytics";
import {
  addDaysToDateKey,
  addMonthsToMonthKey,
  formatShortDay,
  getMonthRange,
  getTodayDateKey,
  getWeekRangeForDateKey,
} from "@/lib/dates";
import { ROADMAP_PHASES } from "@/lib/roadmap-data";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { session, settings } = await requirePageAuth();
  const repo = getRepository();
  const todayKey = getTodayDateKey(settings.timezone);
  const currentMonthKey = todayKey.slice(0, 7);

  // Only fetch sessions from the past ~185 days for charts & streak, or all sessions for accurate historical longest streak
  const [topics, sessions, completionEvents, dailyGoal] = await Promise.all([
    repo.listTopics(session.userId),
    repo.listSessions(session.userId),
    repo.listCompletionEvents(session.userId, { limit: 300 }),
    repo.getGoal(session.userId, "daily", todayKey),
  ]);

  const validSessions = getValidSessions(sessions);
  const primaryTopics = getEligiblePrimaryTopics(topics);
  const eligibleIds = new Set(primaryTopics.map((t) => t.id));

  const overall = calculateRoadmapCompletion(topics);
  const phaseProgress = calculatePhaseProgress(ROADMAP_PHASES, topics);
  const streaks = calculateStreaks(validSessions, todayKey);
  const dailySummary = calculateDailySummary(
    todayKey,
    validSessions,
    completionEvents,
    dailyGoal?.targetMinutes ?? settings.dailyTargetMinutes,
    settings.timezone,
    eligibleIds
  );

  // Current week & month totals
  const thisWeek = getWeekRangeForDateKey(todayKey);
  const thisMonth = getMonthRange(currentMonthKey);

  const weekMinutes = validSessions
    .filter((s) => s.dateKey >= thisWeek.weekStart && s.dateKey <= thisWeek.weekEnd)
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const monthMinutes = validSessions
    .filter(
      (s) => s.dateKey >= thisMonth.startDateKey && s.dateKey <= thisMonth.endDateKey
    )
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  // Daily series (last 14 days)
  const dailySeries: Array<{ label: string; dateKey: string; minutes: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const dk = addDaysToDateKey(todayKey, -i);
    const mins = validSessions
      .filter((s) => s.dateKey === dk)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    dailySeries.push({
      dateKey: dk,
      label: formatShortDay(dk),
      minutes: mins,
    });
  }

  // Weekly series (last 8 weeks)
  const weeklySeries: Array<{ label: string; minutes: number }> = [];
  for (let w = 7; w >= 0; w--) {
    const refDay = addDaysToDateKey(thisWeek.weekStart, -w * 7);
    const wr = getWeekRangeForDateKey(refDay);
    const mins = validSessions
      .filter((s) => s.dateKey >= wr.weekStart && s.dateKey <= wr.weekEnd)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    weeklySeries.push({
      label: wr.weekStart.slice(5),
      minutes: mins,
    });
  }

  // Monthly series (last 6 months)
  const monthlySeries: Array<{ label: string; hours: number }> = [];
  for (let m = 5; m >= 0; m--) {
    const mk = addMonthsToMonthKey(currentMonthKey, -m);
    const mr = getMonthRange(mk);
    const mins = validSessions
      .filter((s) => s.dateKey >= mr.startDateKey && s.dateKey <= mr.endDateKey)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    monthlySeries.push({
      label: mk,
      hours: Math.round((mins / 60) * 10) / 10,
    });
  }

  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const recentSessions = validSessions.slice(0, 6).map((s) => ({
    ...s,
    topicTitle: topicMap.get(s.topicId)?.title || "Unknown Topic",
  }));

  const inProgressTopics = primaryTopics.filter(
    (t) =>
      t.status === "In Progress" ||
      t.status === "Practiced" ||
      t.status === "Needs Revision"
  );

  // Continue topic: latest session's topic (or parent) if not completed, else first In Progress, else first Not Started
  let continueTopic =
    (validSessions[0] ? topicMap.get(validSessions[0].topicId) : null) ?? null;
  if (!continueTopic || continueTopic.status === "Completed") {
    continueTopic =
      inProgressTopics[0] ??
      primaryTopics.find((t) => t.status === "Not Started") ??
      primaryTopics[0] ??
      null;
  }

  const overdueTopics = primaryTopics
    .filter(
      (t) =>
        t.status !== "Completed" &&
        Boolean(t.plannedDate && t.plannedDate < todayKey)
    )
    .slice(0, 4);

  const plannedUpcoming = primaryTopics.filter(
    (t) =>
      t.status !== "Completed" &&
      Boolean(t.plannedDate && t.plannedDate >= todayKey)
  );

  const fallbackUpcoming = primaryTopics
    .filter((t) => t.status === "Not Started" && !t.plannedDate)
    .slice(0, Math.max(0, 5 - plannedUpcoming.length));

  const upcomingTopics = [...plannedUpcoming, ...fallbackUpcoming].slice(0, 5);

  const todaysTopics =
    inProgressTopics.length > 0
      ? inProgressTopics.slice(0, 4)
      : primaryTopics.filter((t) => t.status === "Not Started").slice(0, 3);

  const hasStartedTracking =
    validSessions.length > 0 ||
    topics.some((t) => t.status !== "Not Started" || t.notes.trim().length > 0);

  return (
    <DashboardClient
      csrfToken={session.csrfToken}
      todayKey={todayKey}
      overall={overall}
      phaseProgress={phaseProgress}
      streaks={streaks}
      dailySummary={dailySummary}
      weekMinutes={weekMinutes}
      weeklyTargetMinutes={settings.weeklyTargetMinutes}
      monthMinutes={monthMinutes}
      monthlyTargetMinutes={settings.monthlyTargetMinutes}
      dailySeries={dailySeries}
      weeklySeries={weeklySeries}
      monthlySeries={monthlySeries}
      recentSessions={recentSessions}
      continueTopic={continueTopic}
      upcomingTopics={upcomingTopics}
      overdueTopics={overdueTopics}
      todaysTopics={todaysTopics}
      allTopics={topics}
      hasStartedTracking={hasStartedTracking}
    />
  );
}
