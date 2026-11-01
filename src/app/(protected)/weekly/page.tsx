import { WeeklyClient } from "@/components/weekly-client";
import {
  calculateRoadmapCompletion,
  calculateWeeklyReport,
  getEligiblePrimaryTopics,
} from "@/lib/analytics";
import {
  addDaysToDateKey,
  getTodayDateKey,
  getWeekRangeForDateKey,
  isValidDateKey,
} from "@/lib/dates";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function WeeklyReportPage(context: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { session, settings } = await requirePageAuth();
  const params = await context.searchParams;
  const todayKey = getTodayDateKey(settings.timezone);
  const currentWeek = getWeekRangeForDateKey(todayKey);

  const refDateKey =
    params.week && isValidDateKey(params.week) ? params.week : todayKey;
  const targetWeek = getWeekRangeForDateKey(refDateKey);
  const prevWeek = getWeekRangeForDateKey(
    addDaysToDateKey(targetWeek.weekStart, -7)
  );

  const repo = getRepository();
  const [topics, twoWeekSessions, completionEvents, weeklyGoal, reflection] =
    await Promise.all([
      repo.listTopics(session.userId),
      repo.listSessions(session.userId, {
        startDateKey: prevWeek.weekStart,
        endDateKey: targetWeek.weekEnd,
      }),
      repo.listCompletionEvents(session.userId),
      repo.getGoal(session.userId, "weekly", targetWeek.weekStart),
      repo.getReflection(session.userId, "weekly", targetWeek.weekStart),
    ]);

  const weeklyTargetMinutes =
    weeklyGoal?.targetMinutes ?? settings.weeklyTargetMinutes;

  const report = calculateWeeklyReport({
    referenceDateKey: targetWeek.weekStart,
    sessions: twoWeekSessions.filter(
      (s) =>
        s.dateKey >= targetWeek.weekStart && s.dateKey <= targetWeek.weekEnd
    ),
    previousWeekSessions: twoWeekSessions.filter(
      (s) => s.dateKey >= prevWeek.weekStart && s.dateKey <= prevWeek.weekEnd
    ),
    completionEvents,
    topics,
    weeklyTargetMinutes,
    dailyTargetMinutes: settings.dailyTargetMinutes,
    timezone: settings.timezone,
  });

  const overallRoadmap = calculateRoadmapCompletion(topics);
  const primary = getEligiblePrimaryTopics(topics);
  const outstandingTopics = primary
    .filter(
      (t) =>
        t.status === "In Progress" ||
        t.status === "Needs Revision" ||
        (t.status !== "Completed" &&
          Boolean(t.plannedDate && t.plannedDate <= targetWeek.weekEnd))
    )
    .slice(0, 6);

  return (
    <WeeklyClient
      csrfToken={session.csrfToken}
      currentWeekStart={currentWeek.weekStart}
      report={report}
      overallRoadmap={overallRoadmap}
      outstandingTopics={outstandingTopics}
      initialReflection={reflection}
    />
  );
}
