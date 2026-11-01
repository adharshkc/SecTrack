import { MonthlyClient } from "@/components/monthly-client";
import {
  calculateMonthlyReport,
  calculateStreaks,
  getEligiblePrimaryTopics,
} from "@/lib/analytics";
import { getTodayDateKey, isValidMonthKey } from "@/lib/dates";
import { ROADMAP_PHASES } from "@/lib/roadmap-data";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function MonthlyReportPage(context: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { session, settings } = await requirePageAuth();
  const params = await context.searchParams;
  const todayKey = getTodayDateKey(settings.timezone);
  const currentMonthKey = todayKey.slice(0, 7);
  const monthKey =
    params.month && isValidMonthKey(params.month) ? params.month : currentMonthKey;

  const repo = getRepository();
  const [topics, allSessions, completionEvents, monthlyGoal, reflection] =
    await Promise.all([
      repo.listTopics(session.userId),
      repo.listSessions(session.userId),
      repo.listCompletionEvents(session.userId),
      repo.getGoal(session.userId, "monthly", monthKey),
      repo.getReflection(session.userId, "monthly", monthKey),
    ]);

  const report = calculateMonthlyReport({
    monthKey,
    sessions: allSessions,
    completionEvents,
    topics,
    phases: ROADMAP_PHASES,
    targetMinutes:
      monthlyGoal?.targetMinutes ?? settings.monthlyTargetMinutes,
    targetTopics:
      monthlyGoal?.targetCompletedTopics ?? settings.monthlyTargetTopics,
    targetLabs: monthlyGoal?.targetCompletedLabs ?? settings.monthlyTargetLabs,
    dailyTargetMinutes: settings.dailyTargetMinutes,
    timezone: settings.timezone,
  });

  const streaks = calculateStreaks(allSessions, todayKey);
  const revisionTopics = getEligiblePrimaryTopics(topics).filter(
    (t) =>
      t.status === "Needs Revision" || (t.confidence > 0 && t.confidence <= 2)
  );

  return (
    <MonthlyClient
      csrfToken={session.csrfToken}
      currentMonthKey={currentMonthKey}
      report={report}
      streaks={streaks}
      revisionTopics={revisionTopics}
      initialReflection={reflection}
    />
  );
}
