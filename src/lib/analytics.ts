import {
  addDaysToDateKey,
  diffCalendarDays,
  formatDateKeyInTimezone,
  getMonthRange,
  getWeekRangeForDateKey,
  isValidDateKey,
} from "./dates";
import type {
  CompletionEvent,
  RoadmapPhase,
  StudySession,
  Topic,
  TopicStatus,
} from "./types";

export interface RoadmapCompletionSummary {
  eligibleTopicsCount: number;
  completedTopicsCount: number;
  inProgressTopicsCount: number;
  practicedTopicsCount: number;
  needsRevisionTopicsCount: number;
  notStartedTopicsCount: number;
  completionPercentage: number;
  totalSubtopicsCount: number;
  completedSubtopicsCount: number;
}

/**
 * Eligible primary topics for overall roadmap completion:
 * - Excludes non-trackable structural/container nodes (isTrackable === false)
 * - Excludes subtopics (parentTopicId !== null) from the primary denominator so a parent
 *   topic and its subtopics are never double-counted
 * - Deduplicates by topic.id so the same completed topic can never be counted twice
 */
export function getEligiblePrimaryTopics(topics: Topic[]): Topic[] {
  const seen = new Set<string>();
  const eligible: Topic[] = [];
  for (const t of topics) {
    if (!t || !t.id) continue;
    if (t.isTrackable === false) continue;
    if (t.parentTopicId !== null) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    eligible.push(t);
  }
  return eligible;
}

export function calculateRoadmapCompletion(topics: Topic[]): RoadmapCompletionSummary {
  const eligible = getEligiblePrimaryTopics(topics);
  const seenSubs = new Set<string>();
  let totalSubtopicsCount = 0;
  let completedSubtopicsCount = 0;

  for (const t of topics) {
    if (!t || !t.id || t.isTrackable === false) continue;
    if (t.parentTopicId !== null && !seenSubs.has(t.id)) {
      seenSubs.add(t.id);
      totalSubtopicsCount++;
      if (t.status === "Completed") completedSubtopicsCount++;
    }
  }

  let completedTopicsCount = 0;
  let inProgressTopicsCount = 0;
  let practicedTopicsCount = 0;
  let needsRevisionTopicsCount = 0;
  let notStartedTopicsCount = 0;

  for (const t of eligible) {
    switch (t.status) {
      case "Completed":
        completedTopicsCount++;
        break;
      case "In Progress":
        inProgressTopicsCount++;
        break;
      case "Practiced":
        practicedTopicsCount++;
        break;
      case "Needs Revision":
        needsRevisionTopicsCount++;
        break;
      default:
        notStartedTopicsCount++;
        break;
    }
  }

  const completionPercentage =
    eligible.length === 0
      ? 0
      : Math.round((completedTopicsCount / eligible.length) * 1000) / 10;

  return {
    eligibleTopicsCount: eligible.length,
    completedTopicsCount,
    inProgressTopicsCount,
    practicedTopicsCount,
    needsRevisionTopicsCount,
    notStartedTopicsCount,
    completionPercentage,
    totalSubtopicsCount,
    completedSubtopicsCount,
  };
}

export interface SubtopicProgress {
  total: number;
  completed: number;
  percentage: number;
}

export function calculateTopicSubtopicProgress(
  parentTopicId: string,
  allTopics: Topic[]
): SubtopicProgress {
  const seen = new Set<string>();
  let total = 0;
  let completed = 0;
  for (const t of allTopics) {
    if (t.parentTopicId === parentTopicId && t.isTrackable !== false && !seen.has(t.id)) {
      seen.add(t.id);
      total++;
      if (t.status === "Completed") completed++;
    }
  }
  return {
    total,
    completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 1000) / 10,
  };
}

export interface PhaseProgressItem {
  phaseId: string;
  title: string;
  shortTitle: string;
  order: number;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  percentage: number;
}

export function calculatePhaseProgress(
  phases: RoadmapPhase[],
  topics: Topic[]
): PhaseProgressItem[] {
  const eligible = getEligiblePrimaryTopics(topics);
  return [...phases]
    .sort((a, b) => a.order - b.order)
    .map((phase) => {
      const phaseTopics = eligible.filter((t) => t.phaseId === phase.id);
      const completed = phaseTopics.filter((t) => t.status === "Completed").length;
      const inProgress = phaseTopics.filter(
        (t) => t.status === "In Progress" || t.status === "Practiced"
      ).length;
      const percentage =
        phaseTopics.length === 0
          ? 0
          : Math.round((completed / phaseTopics.length) * 1000) / 10;
      return {
        phaseId: phase.id,
        title: phase.title,
        shortTitle: phase.shortTitle,
        order: phase.order,
        totalTopics: phaseTopics.length,
        completedTopics: completed,
        inProgressTopics: inProgress,
        percentage,
      };
    });
}

export function calculateGoalPercentage(actual: number, target: number): number {
  if (target <= 0) return 0;
  const safeActual = Math.max(0, actual);
  return Math.round((safeActual / target) * 1000) / 10;
}

export function getValidSessions(sessions: StudySession[]): StudySession[] {
  const seenIds = new Set<string>();
  const valid: StudySession[] = [];
  for (const s of sessions) {
    if (!s || !s.id || seenIds.has(s.id)) continue;
    if (!Number.isFinite(s.durationMinutes) || s.durationMinutes <= 0) continue;
    if (!isValidDateKey(s.dateKey)) continue;
    seenIds.add(s.id);
    valid.push(s);
  }
  return valid;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  studiedToday: boolean;
  lastActiveDateKey: string | null;
}

/**
 * Calculates current and longest learning streaks strictly from persisted valid study sessions.
 * - A learning day is any calendar dateKey with >= 1 valid study session (durationMinutes > 0).
 * - If today has a session, currentStreak counts backward starting from today.
 * - If today has NO session yet, but yesterday had a session, today's incomplete activity does
 *   not prematurely break the active streak until today passes without study.
 * - Missing a full calendar day breaks the streak (currentStreak = 0).
 */
export function calculateStreaks(
  sessions: StudySession[],
  todayDateKey: string
): StreakResult {
  const valid = getValidSessions(sessions);
  const activeDatesSet = new Set<string>();
  for (const s of valid) {
    // Only count dates up to todayDateKey for current streak integrity
    activeDatesSet.add(s.dateKey);
  }

  const sortedDates = Array.from(activeDatesSet).sort();
  if (sortedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      studiedToday: false,
      lastActiveDateKey: null,
    };
  }

  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const gap = diffCalendarDays(sortedDates[i - 1], sortedDates[i]);
    if (gap === 1) {
      running++;
      if (running > longestStreak) longestStreak = running;
    } else if (gap > 1) {
      running = 1;
    }
  }

  const studiedToday = activeDatesSet.has(todayDateKey);
  const yesterdayKey = addDaysToDateKey(todayDateKey, -1);
  const studiedYesterday = activeDatesSet.has(yesterdayKey);

  let currentStreak = 0;
  if (studiedToday || studiedYesterday) {
    let cursor = studiedToday ? todayDateKey : yesterdayKey;
    while (activeDatesSet.has(cursor)) {
      currentStreak++;
      cursor = addDaysToDateKey(cursor, -1);
    }
  }

  const pastOrTodayDates = sortedDates.filter((d) => d <= todayDateKey);
  const lastActiveDateKey =
    pastOrTodayDates.length > 0
      ? pastOrTodayDates[pastOrTodayDates.length - 1]
      : sortedDates[sortedDates.length - 1];

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: sortedDates.length,
    studiedToday,
    lastActiveDateKey,
  };
}

export interface DailySummary {
  dateKey: string;
  totalMinutes: number;
  sessionCount: number;
  topicsStudiedCount: number;
  topicsCompletedCount: number;
  targetMinutes: number;
  goalPercentage: number;
  goalAchieved: boolean;
}

export function calculateDailySummary(
  dateKey: string,
  sessions: StudySession[],
  completionEvents: CompletionEvent[],
  targetMinutes: number,
  timezone: string,
  eligibleTopicIds?: Set<string>
): DailySummary {
  const valid = getValidSessions(sessions).filter((s) => s.dateKey === dateKey);
  const totalMinutes = valid.reduce((acc, s) => acc + s.durationMinutes, 0);
  const topicsStudied = new Set(valid.map((s) => s.topicId));

  const completedTopicsOnDay = new Set<string>();
  for (const ev of completionEvents) {
    if (ev.newStatus !== "Completed") continue;
    if (eligibleTopicIds && !eligibleTopicIds.has(ev.topicId)) continue;
    try {
      const evDateKey = formatDateKeyInTimezone(ev.occurredAt, timezone);
      if (evDateKey === dateKey) {
        completedTopicsOnDay.add(ev.topicId);
      }
    } catch {
      // ignore malformed timestamps
    }
  }

  const goalPercentage = calculateGoalPercentage(totalMinutes, targetMinutes);
  return {
    dateKey,
    totalMinutes,
    sessionCount: valid.length,
    topicsStudiedCount: topicsStudied.size,
    topicsCompletedCount: completedTopicsOnDay.size,
    targetMinutes,
    goalPercentage,
    goalAchieved: targetMinutes > 0 && totalMinutes >= targetMinutes,
  };
}

export interface WeeklyReportSummary {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  totalHours: number;
  previousWeekMinutes: number;
  weekOverWeekDeltaMinutes: number;
  weekOverWeekChangePercent: number | null;
  totalSessions: number;
  topicsStudiedCount: number;
  topicsCompletedCount: number;
  weeklyTargetMinutes: number;
  weeklyTimeGoalPercentage: number;
  dailyTargetMinutes: number;
  daysMeetingDailyGoal: number;
  activeDaysCount: number;
  consistencyPercentage: number;
  dailyBreakdown: Array<{
    dateKey: string;
    minutes: number;
    sessions: number;
    goalAchieved: boolean;
  }>;
}

export function calculateWeeklyReport(params: {
  referenceDateKey: string;
  sessions: StudySession[];
  previousWeekSessions: StudySession[];
  completionEvents: CompletionEvent[];
  topics: Topic[];
  weeklyTargetMinutes: number;
  dailyTargetMinutes: number;
  timezone: string;
}): WeeklyReportSummary {
  const { weekStart, weekEnd, days } = getWeekRangeForDateKey(params.referenceDateKey);
  const validWeek = getValidSessions(params.sessions).filter(
    (s) => s.dateKey >= weekStart && s.dateKey <= weekEnd
  );
  const prevRange = getWeekRangeForDateKey(addDaysToDateKey(weekStart, -7));
  const validPrev = getValidSessions(params.previousWeekSessions).filter(
    (s) => s.dateKey >= prevRange.weekStart && s.dateKey <= prevRange.weekEnd
  );

  const totalMinutes = validWeek.reduce((sum, s) => sum + s.durationMinutes, 0);
  const previousWeekMinutes = validPrev.reduce((sum, s) => sum + s.durationMinutes, 0);
  const weekOverWeekDeltaMinutes = totalMinutes - previousWeekMinutes;
  const weekOverWeekChangePercent =
    previousWeekMinutes === 0
      ? totalMinutes > 0
        ? 100
        : 0
      : Math.round(((totalMinutes - previousWeekMinutes) / previousWeekMinutes) * 1000) /
        10;

  const eligibleIds = new Set(getEligiblePrimaryTopics(params.topics).map((t) => t.id));
  const completedInWeek = new Set<string>();
  for (const ev of params.completionEvents) {
    if (ev.newStatus !== "Completed") continue;
    if (!eligibleIds.has(ev.topicId)) continue;
    try {
      const evDay = formatDateKeyInTimezone(ev.occurredAt, params.timezone);
      if (evDay >= weekStart && evDay <= weekEnd) {
        completedInWeek.add(ev.topicId);
      }
    } catch {
      // ignore
    }
  }

  let daysMeetingDailyGoal = 0;
  let activeDaysCount = 0;

  const dailyBreakdown = days.map((dayKey) => {
    const daySessions = validWeek.filter((s) => s.dateKey === dayKey);
    const minutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    if (minutes > 0) activeDaysCount++;
    const goalAchieved =
      params.dailyTargetMinutes > 0 && minutes >= params.dailyTargetMinutes;
    if (goalAchieved) daysMeetingDailyGoal++;
    return {
      dateKey: dayKey,
      minutes,
      sessions: daySessions.length,
      goalAchieved,
    };
  });

  return {
    weekStart,
    weekEnd,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    previousWeekMinutes,
    weekOverWeekDeltaMinutes,
    weekOverWeekChangePercent,
    totalSessions: validWeek.length,
    topicsStudiedCount: new Set(validWeek.map((s) => s.topicId)).size,
    topicsCompletedCount: completedInWeek.size,
    weeklyTargetMinutes: params.weeklyTargetMinutes,
    weeklyTimeGoalPercentage: calculateGoalPercentage(
      totalMinutes,
      params.weeklyTargetMinutes
    ),
    dailyTargetMinutes: params.dailyTargetMinutes,
    daysMeetingDailyGoal,
    activeDaysCount,
    consistencyPercentage: Math.round((activeDaysCount / 7) * 1000) / 10,
    dailyBreakdown,
  };
}

/**
 * Reconstructs historical roadmap completion percentage at the end of a given `asOfDateKey`
 * in `timezone` using persisted CompletionEvent records!
 * - Does NOT rely on current topic.status alone: if a topic was completed on Feb 10 and
 *   reopened for revision on Mar 5, its status as of Feb 28 was "Completed", and as of Mar 31
 *   is "Needs Revision".
 */
export function calculateHistoricalCompletionAtDateKey(
  topics: Topic[],
  completionEvents: CompletionEvent[],
  asOfDateKey: string,
  timezone: string
): { completedCount: number; eligibleCount: number; percentage: number } {
  const eligible = getEligiblePrimaryTopics(topics);
  if (eligible.length === 0) {
    return { completedCount: 0, eligibleCount: 0, percentage: 0 };
  }

  // Group events by topicId sorted chronologically
  const eventsByTopic = new Map<string, CompletionEvent[]>();
  for (const ev of completionEvents) {
    const list = eventsByTopic.get(ev.topicId) ?? [];
    list.push(ev);
    eventsByTopic.set(ev.topicId, list);
  }
  for (const list of eventsByTopic.values()) {
    list.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  let completedCount = 0;
  for (const topic of eligible) {
    const events = eventsByTopic.get(topic.id);
    if (events && events.length > 0) {
      let statusAtCutoff: TopicStatus = "Not Started";
      for (const ev of events) {
        try {
          const evDateKey = formatDateKeyInTimezone(ev.occurredAt, timezone);
          if (evDateKey <= asOfDateKey) {
            statusAtCutoff = ev.newStatus;
          }
        } catch {
          // ignore
        }
      }
      if (statusAtCutoff === "Completed") {
        completedCount++;
      }
    } else if (topic.status === "Completed" && topic.completedAt) {
      // Fallback only if a completed topic was imported without historical event records
      try {
        const compKey = formatDateKeyInTimezone(topic.completedAt, timezone);
        if (compKey <= asOfDateKey) {
          completedCount++;
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    completedCount,
    eligibleCount: eligible.length,
    percentage: Math.round((completedCount / eligible.length) * 1000) / 10,
  };
}

export interface MonthlyReportSummary {
  monthKey: string;
  startDateKey: string;
  endDateKey: string;
  totalMinutes: number;
  totalHours: number;
  totalSessions: number;
  practicalLabSessions: number;
  topicsCompletedInMonth: number;
  roadmapProgressStartOfMonth: number;
  roadmapProgressEndOfMonth: number;
  dailyGoalAchievementRate: number;
  daysMeetingDailyGoal: number;
  activeDaysCount: number;
  longestStreakInMonth: number;
  targets: {
    targetMinutes: number;
    hoursPercentage: number;
    targetTopics: number;
    topicsPercentage: number;
    targetLabs: number;
    labsPercentage: number;
  };
  phaseDistribution: Array<{
    phaseId: string;
    phaseTitle: string;
    minutes: number;
    hours: number;
    percentage: number;
  }>;
  weeklyBreakdown: Array<{
    label: string;
    startDateKey: string;
    endDateKey: string;
    minutes: number;
    sessions: number;
  }>;
  dailyCalendar: Array<{
    dateKey: string;
    minutes: number;
    sessions: number;
    goalAchieved: boolean;
  }>;
}

export function calculateMonthlyReport(params: {
  monthKey: string;
  sessions: StudySession[];
  completionEvents: CompletionEvent[];
  topics: Topic[];
  phases: RoadmapPhase[];
  targetMinutes: number;
  targetTopics: number;
  targetLabs: number;
  dailyTargetMinutes: number;
  timezone: string;
}): MonthlyReportSummary {
  const range = getMonthRange(params.monthKey);
  const validMonth = getValidSessions(params.sessions).filter(
    (s) => s.dateKey >= range.startDateKey && s.dateKey <= range.endDateKey
  );

  const totalMinutes = validMonth.reduce((sum, s) => sum + s.durationMinutes, 0);
  const practicalLabSessions = validMonth.filter(
    (s) =>
      s.activityType === "Lab" ||
      s.activityType === "CTF" ||
      s.activityType === "Project"
  ).length;

  const eligibleIds = new Set(getEligiblePrimaryTopics(params.topics).map((t) => t.id));
  const completedTopicsInMonth = new Set<string>();
  for (const ev of params.completionEvents) {
    if (ev.newStatus !== "Completed") continue;
    if (!eligibleIds.has(ev.topicId)) continue;
    try {
      const evDay = formatDateKeyInTimezone(ev.occurredAt, params.timezone);
      if (evDay >= range.startDateKey && evDay <= range.endDateKey) {
        completedTopicsInMonth.add(ev.topicId);
      }
    } catch {
      // ignore
    }
  }

  const dayBeforeMonthStart = addDaysToDateKey(range.startDateKey, -1);
  const startSnap = calculateHistoricalCompletionAtDateKey(
    params.topics,
    params.completionEvents,
    dayBeforeMonthStart,
    params.timezone
  );
  const endSnap = calculateHistoricalCompletionAtDateKey(
    params.topics,
    params.completionEvents,
    range.endDateKey,
    params.timezone
  );

  // Phase study time distribution
  const topicById = new Map(params.topics.map((t) => [t.id, t]));
  const minutesByPhase = new Map<string, number>();
  for (const s of validMonth) {
    const topic = topicById.get(s.topicId);
    const phaseId = topic?.phaseId ?? "unassigned";
    minutesByPhase.set(phaseId, (minutesByPhase.get(phaseId) ?? 0) + s.durationMinutes);
  }

  const phaseDistribution = [...params.phases]
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const mins = minutesByPhase.get(p.id) ?? 0;
      return {
        phaseId: p.id,
        phaseTitle: p.shortTitle || p.title,
        minutes: mins,
        hours: Math.round((mins / 60) * 10) / 10,
        percentage:
          totalMinutes === 0 ? 0 : Math.round((mins / totalMinutes) * 1000) / 10,
      };
    });

  // Daily calendar + longest streak inside month
  let daysMeetingDailyGoal = 0;
  let activeDaysCount = 0;
  let runningStreak = 0;
  let longestStreakInMonth = 0;

  const dailyCalendar = range.days.map((dayKey) => {
    const daySessions = validMonth.filter((s) => s.dateKey === dayKey);
    const minutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    if (minutes > 0) {
      activeDaysCount++;
      runningStreak++;
      if (runningStreak > longestStreakInMonth) longestStreakInMonth = runningStreak;
    } else {
      runningStreak = 0;
    }
    const goalAchieved =
      params.dailyTargetMinutes > 0 && minutes >= params.dailyTargetMinutes;
    if (goalAchieved) daysMeetingDailyGoal++;
    return {
      dateKey: dayKey,
      minutes,
      sessions: daySessions.length,
      goalAchieved,
    };
  });

  // Weekly chunks within the month (Days 1-7, 8-14, 15-21, 22-28, 29-end)
  const weeklyBreakdown: MonthlyReportSummary["weeklyBreakdown"] = [];
  for (let i = 0; i < range.days.length; i += 7) {
    const slice = range.days.slice(i, i + 7);
    const sliceStart = slice[0];
    const sliceEnd = slice[slice.length - 1];
    const sliceSessions = validMonth.filter(
      (s) => s.dateKey >= sliceStart && s.dateKey <= sliceEnd
    );
    weeklyBreakdown.push({
      label: `Week ${Math.floor(i / 7) + 1}`,
      startDateKey: sliceStart,
      endDateKey: sliceEnd,
      minutes: sliceSessions.reduce((sum, s) => sum + s.durationMinutes, 0),
      sessions: sliceSessions.length,
    });
  }

  return {
    monthKey: params.monthKey,
    startDateKey: range.startDateKey,
    endDateKey: range.endDateKey,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalSessions: validMonth.length,
    practicalLabSessions,
    topicsCompletedInMonth: completedTopicsInMonth.size,
    roadmapProgressStartOfMonth: startSnap.percentage,
    roadmapProgressEndOfMonth: endSnap.percentage,
    dailyGoalAchievementRate:
      range.daysInMonth === 0
        ? 0
        : Math.round((daysMeetingDailyGoal / range.daysInMonth) * 1000) / 10,
    daysMeetingDailyGoal,
    activeDaysCount,
    longestStreakInMonth,
    targets: {
      targetMinutes: params.targetMinutes,
      hoursPercentage: calculateGoalPercentage(totalMinutes, params.targetMinutes),
      targetTopics: params.targetTopics,
      topicsPercentage: calculateGoalPercentage(
        completedTopicsInMonth.size,
        params.targetTopics
      ),
      targetLabs: params.targetLabs,
      labsPercentage: calculateGoalPercentage(practicalLabSessions, params.targetLabs),
    },
    phaseDistribution,
    weeklyBreakdown,
    dailyCalendar,
  };
}

/**
 * Prevents accidental duplicate study session creation from rapid double-clicks or retries:
 * Rejects an identical session created within `windowMs` (default 15 seconds) matching
 * topicId, dateKey, durationMinutes, activityType, startedAt, and notes.
 */
export function isDuplicateSessionSubmission(
  existingSessions: StudySession[],
  candidate: {
    topicId: string;
    dateKey: string;
    startedAt: string | null;
    durationMinutes: number;
    activityType: string;
    notes: string;
  },
  nowMs: number = Date.now(),
  windowMs: number = 15_000
): boolean {
  for (const s of existingSessions) {
    if (
      s.topicId === candidate.topicId &&
      s.dateKey === candidate.dateKey &&
      (s.startedAt ?? null) === (candidate.startedAt ?? null) &&
      s.durationMinutes === candidate.durationMinutes &&
      s.activityType === candidate.activityType &&
      s.notes.trim() === candidate.notes.trim()
    ) {
      const createdMs = new Date(s.createdAt).getTime();
      if (!Number.isNaN(createdMs) && Math.abs(nowMs - createdMs) <= windowMs) {
        return true;
      }
    }
  }
  return false;
}
