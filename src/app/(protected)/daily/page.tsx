import { DailyClient } from "@/components/daily-client";
import {
  calculateDailySummary,
  getEligiblePrimaryTopics,
} from "@/lib/analytics";
import { getTodayDateKey, isValidDateKey } from "@/lib/dates";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function DailyTrackerPage(context: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { session, settings } = await requirePageAuth();
  const params = await context.searchParams;
  const todayKey = getTodayDateKey(settings.timezone);
  const dateKey =
    params.date && isValidDateKey(params.date) ? params.date : todayKey;

  const repo = getRepository();
  const [topics, daySessions, completionEvents, dailyGoal, reflection] =
    await Promise.all([
      repo.listTopics(session.userId),
      repo.listSessions(session.userId, {
        startDateKey: dateKey,
        endDateKey: dateKey,
      }),
      repo.listCompletionEvents(session.userId, { limit: 300 }),
      repo.getGoal(session.userId, "daily", dateKey),
      repo.getReflection(session.userId, "daily", dateKey),
    ]);

  const targetMinutes = dailyGoal?.targetMinutes ?? settings.dailyTargetMinutes;
  const eligibleIds = new Set(getEligiblePrimaryTopics(topics).map((t) => t.id));
  const summary = calculateDailySummary(
    dateKey,
    daySessions,
    completionEvents,
    targetMinutes,
    settings.timezone,
    eligibleIds
  );

  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const enrichedSessions = daySessions.map((s) => ({
    ...s,
    topicTitle: topicMap.get(s.topicId)?.title || "Deleted Topic",
  }));

  return (
    <DailyClient
      csrfToken={session.csrfToken}
      dateKey={dateKey}
      todayKey={todayKey}
      timezone={settings.timezone}
      summary={summary}
      sessions={enrichedSessions}
      topics={topics}
      initialReflection={reflection}
    />
  );
}
