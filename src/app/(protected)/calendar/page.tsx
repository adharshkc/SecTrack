import { CalendarClient } from "@/components/calendar-client";
import { calculateStreaks, getValidSessions } from "@/lib/analytics";
import { getMonthRange, getTodayDateKey, isValidMonthKey } from "@/lib/dates";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function CalendarPage(context: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { session, settings } = await requirePageAuth();
  const params = await context.searchParams;
  const todayKey = getTodayDateKey(settings.timezone);
  const currentMonthKey = todayKey.slice(0, 7);
  const monthKey =
    params.month && isValidMonthKey(params.month) ? params.month : currentMonthKey;

  const range = getMonthRange(monthKey);
  const repo = getRepository();
  const [topics, allSessions] = await Promise.all([
    repo.listTopics(session.userId),
    repo.listSessions(session.userId),
  ]);

  const valid = getValidSessions(allSessions);
  const streaks = calculateStreaks(valid, todayKey);
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const sessionsInMonth = valid
    .filter(
      (s) => s.dateKey >= range.startDateKey && s.dateKey <= range.endDateKey
    )
    .map((s) => ({
      ...s,
      topicTitle: topicMap.get(s.topicId)?.title || "Unknown Topic",
    }));

  return (
    <CalendarClient
      monthKey={monthKey}
      todayKey={todayKey}
      days={range.days}
      streaks={streaks}
      sessionsInMonth={sessionsInMonth}
      dailyTargetMinutes={settings.dailyTargetMinutes}
    />
  );
}
