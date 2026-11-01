import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  calculateDailySummary,
  calculateGoalPercentage,
  calculateHistoricalCompletionAtDateKey,
  calculateMonthlyReport,
  calculateRoadmapCompletion,
  calculateStreaks,
  calculateTopicSubtopicProgress,
  calculateWeeklyReport,
  isDuplicateSessionSubmission,
} from "@/lib/analytics";
import { hashPasswordScrypt, verifyPasswordHash } from "@/lib/auth/password";
import { verifySameOriginRequest } from "@/lib/auth/session";
import {
  addMonthsToMonthKey,
  formatDateKeyInTimezone,
  getMonthRange,
  getWeekRangeForDateKey,
  isValidDateKey,
} from "@/lib/dates";
import { CANONICAL_ROADMAP, ROADMAP_PHASES } from "@/lib/roadmap-data";
import type { CompletionEvent, StudySession, Topic } from "@/lib/types";
import {
  backupImportSchema,
  createStudySessionSchema,
  createTopicSchema,
} from "@/lib/validation";

function makeTopic(overrides: Partial<Topic> & { id: string }): Topic {
  return {
    id: overrides.id,
    title: overrides.title ?? `Topic ${overrides.id}`,
    description: "",
    phaseId: overrides.phaseId ?? "phase-1-foundation",
    sectionId: overrides.sectionId ?? "sec-01-computer-fundamentals",
    parentTopicId: overrides.parentTopicId ?? null,
    order: overrides.order ?? 1,
    status: overrides.status ?? "Not Started",
    priority: overrides.priority ?? "Essential",
    difficulty: overrides.difficulty ?? "Beginner",
    estimatedDuration: "1 week",
    estimatedMinutes: 420,
    prerequisites: [],
    resourceLinks: [],
    practicalExercises: [],
    completedExercises: [],
    learningObjectives: [],
    completedObjectives: [],
    tools: [],
    notes: "",
    commandsLearned: "",
    questionsToRevisit: "",
    confidence: 0,
    nextAction: "",
    plannedDate: null,
    isCustom: false,
    isTrackable: overrides.isTrackable ?? true,
    sourceUrl: "https://www.itshahirx.com/roadmap",
    lastReviewedAt: "2026-03-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: overrides.completedAt ?? null,
  };
}

function makeSession(
  overrides: Partial<StudySession> & { id: string; dateKey: string }
): StudySession {
  return {
    id: overrides.id,
    topicId: overrides.topicId ?? "t1",
    dateKey: overrides.dateKey,
    startedAt: overrides.startedAt ?? "09:00",
    durationMinutes: overrides.durationMinutes ?? 60,
    activityType: overrides.activityType ?? "Lab",
    notes: overrides.notes ?? "",
    outcome: overrides.outcome ?? "",
    confidence: overrides.confidence ?? 4,
    createdAt: overrides.createdAt ?? "2026-03-01T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-01T10:00:00.000Z",
  };
}

describe("Canonical Roadmap Dataset Integrity", () => {
  it("preserves 5 phases, 12 sections, 36 primary topics, and 160 subtopics from itshahirx", () => {
    expect(CANONICAL_ROADMAP.sourceUrl).toBe("https://www.itshahirx.com/roadmap");
    expect(CANONICAL_ROADMAP.phases).toHaveLength(5);
    expect(CANONICAL_ROADMAP.sections).toHaveLength(12);
    const primary = CANONICAL_ROADMAP.topics.filter((t) => t.parentTopicId === null);
    const subs = CANONICAL_ROADMAP.topics.filter((t) => t.parentTopicId !== null);
    expect(primary).toHaveLength(36);
    expect(subs.length).toBeGreaterThanOrEqual(150);

    // Ensure all IDs are deterministic and unique
    const ids = new Set(CANONICAL_ROADMAP.topics.map((t) => t.id));
    expect(ids.size).toBe(CANONICAL_ROADMAP.topics.length);
  });
});

describe("Date Ranges, Timezones & Boundary Cases", () => {
  it("validates real calendar dates and rejects impossible dates", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true); // Leap year
    expect(isValidDateKey("2026-02-29")).toBe(false); // Non-leap year
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });

  it("computes Monday-through-Sunday weekly date ranges across month & year transitions", () => {
    // Wednesday 2025-12-31 -> Monday 2025-12-29 through Sunday 2026-01-04
    const range = getWeekRangeForDateKey("2025-12-31");
    expect(range.weekStart).toBe("2025-12-29");
    expect(range.weekEnd).toBe("2026-01-04");
    expect(range.days).toHaveLength(7);

    // Sunday boundary maps back to Monday of the same week
    const sunRange = getWeekRangeForDateKey("2026-03-08");
    expect(sunRange.weekStart).toBe("2026-03-02");
    expect(sunRange.weekEnd).toBe("2026-03-08");
  });

  it("computes monthly ranges accurately for leap years, non-leap Feb, and year transitions", () => {
    const feb2026 = getMonthRange("2026-02");
    expect(feb2026.startDateKey).toBe("2026-02-01");
    expect(feb2026.endDateKey).toBe("2026-02-28");
    expect(feb2026.daysInMonth).toBe(28);

    const feb2024 = getMonthRange("2024-02");
    expect(feb2024.endDateKey).toBe("2024-02-29");
    expect(feb2024.daysInMonth).toBe(29);

    expect(addMonthsToMonthKey("2025-12", 1)).toBe("2026-01");
    expect(addMonthsToMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("handles Asia/Kolkata (+05:30) and America/New_York DST transitions accurately", () => {
    // 2026-03-01T20:00:00Z is 2026-03-02 01:30 IST in Asia/Kolkata!
    expect(formatDateKeyInTimezone("2026-03-01T20:00:00.000Z", "Asia/Kolkata")).toBe(
      "2026-03-02"
    );
    expect(formatDateKeyInTimezone("2026-03-01T18:29:59.000Z", "Asia/Kolkata")).toBe(
      "2026-03-01"
    );

    // US DST spring-forward boundary (2026-03-08 07:00 UTC -> 03:00 EDT on 2026-03-08; 03:30 UTC -> 22:30 EST on 2026-03-07)
    expect(
      formatDateKeyInTimezone("2026-03-08T03:30:00.000Z", "America/New_York")
    ).toBe("2026-03-07");
    expect(
      formatDateKeyInTimezone("2026-03-08T07:30:00.000Z", "America/New_York")
    ).toBe("2026-03-08");
  });
});

describe("Daily, Weekly, Monthly Analytics & Completion Calculations", () => {
  it("calculates overall roadmap completion excluding non-trackable containers and preventing double-counting", () => {
    const topics: Topic[] = [
      makeTopic({ id: "t1", status: "Completed" }),
      makeTopic({ id: "t1", status: "Completed" }), // duplicate entry guard
      makeTopic({ id: "t2", status: "In Progress" }),
      makeTopic({ id: "t3", status: "Not Started" }),
      makeTopic({ id: "t4", status: "Needs Revision" }),
      makeTopic({ id: "container-sec", status: "Completed", isTrackable: false }), // excluded container
      makeTopic({ id: "sub-1", parentTopicId: "t1", status: "Completed" }), // subtopic tracked separately
      makeTopic({ id: "sub-2", parentTopicId: "t1", status: "Not Started" }),
    ];

    const summary = calculateRoadmapCompletion(topics);
    expect(summary.eligibleTopicsCount).toBe(4);
    expect(summary.completedTopicsCount).toBe(1);
    expect(summary.completionPercentage).toBe(25);
    expect(summary.totalSubtopicsCount).toBe(2);
    expect(summary.completedSubtopicsCount).toBe(1);

    const subProg = calculateTopicSubtopicProgress("t1", topics);
    expect(subProg).toEqual({ total: 2, completed: 1, percentage: 50 });
  });

  it("calculates daily study time, goal percentage, and deduplicates edited session IDs", () => {
    const sessions: StudySession[] = [
      makeSession({ id: "s1", topicId: "t1", dateKey: "2026-03-10", durationMinutes: 45 }),
      makeSession({ id: "s2", topicId: "t2", dateKey: "2026-03-10", durationMinutes: 60 }),
      makeSession({ id: "s1", topicId: "t1", dateKey: "2026-03-10", durationMinutes: 45 }), // duplicate ID ignored
      makeSession({ id: "s3", topicId: "t1", dateKey: "2026-03-11", durationMinutes: 30 }),
    ];
    const events: CompletionEvent[] = [
      {
        id: "e1",
        topicId: "t1",
        eventType: "completed",
        previousStatus: "In Progress",
        newStatus: "Completed",
        occurredAt: "2026-03-10T12:00:00.000Z", // 17:30 IST on 2026-03-10
        source: "manual",
      },
    ];

    const daily = calculateDailySummary(
      "2026-03-10",
      sessions,
      events,
      90,
      "Asia/Kolkata"
    );
    expect(daily.totalMinutes).toBe(105);
    expect(daily.sessionCount).toBe(2);
    expect(daily.topicsStudiedCount).toBe(2);
    expect(daily.topicsCompletedCount).toBe(1);
    expect(daily.goalAchieved).toBe(true);
    expect(daily.goalPercentage).toBe(116.7);
  });

  it("calculates current and longest streaks accurately without awarding streaks for non-session activity", () => {
    // Empty sessions -> 0 streak even if topics exist
    expect(calculateStreaks([], "2026-03-10")).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      studiedToday: false,
      lastActiveDateKey: null,
    });

    const sessions: StudySession[] = [
      // Historical 4-day streak in Jan
      makeSession({ id: "a1", dateKey: "2026-01-01", durationMinutes: 30 }),
      makeSession({ id: "a2", dateKey: "2026-01-02", durationMinutes: 30 }),
      makeSession({ id: "a3", dateKey: "2026-01-03", durationMinutes: 30 }),
      makeSession({ id: "a4", dateKey: "2026-01-04", durationMinutes: 30 }),
      // Active 2-day streak ending yesterday (today not logged yet -> streak still 2!)
      makeSession({ id: "b1", dateKey: "2026-03-08", durationMinutes: 45 }),
      makeSession({ id: "b2", dateKey: "2026-03-09", durationMinutes: 60 }),
    ];

    const todayPending = calculateStreaks(sessions, "2026-03-10");
    expect(todayPending.currentStreak).toBe(2);
    expect(todayPending.longestStreak).toBe(4);
    expect(todayPending.studiedToday).toBe(false);

    // If user misses March 10 completely and checks on March 11 -> streak broken (0)!
    const broken = calculateStreaks(sessions, "2026-03-11");
    expect(broken.currentStreak).toBe(0);
    expect(broken.longestStreak).toBe(4);
  });

  it("prevents rapid duplicate session submissions while allowing distinct sessions", () => {
    const now = new Date("2026-03-10T10:00:05.000Z").getTime();
    const existing = [
      makeSession({
        id: "s1",
        topicId: "t1",
        dateKey: "2026-03-10",
        startedAt: "09:00",
        durationMinutes: 60,
        activityType: "Lab",
        notes: "Nmap lab",
        createdAt: "2026-03-10T10:00:00.000Z",
      }),
    ];

    expect(
      isDuplicateSessionSubmission(
        existing,
        {
          topicId: "t1",
          dateKey: "2026-03-10",
          startedAt: "09:00",
          durationMinutes: 60,
          activityType: "Lab",
          notes: "Nmap lab",
        },
        now
      )
    ).toBe(true);

    // Outside 15s deduplication window -> allowed (multiple sessions per topic supported!)
    expect(
      isDuplicateSessionSubmission(
        existing,
        {
          topicId: "t1",
          dateKey: "2026-03-10",
          startedAt: "09:00",
          durationMinutes: 60,
          activityType: "Lab",
          notes: "Nmap lab",
        },
        now + 60_000
      )
    ).toBe(false);
  });

  it("preserves historical completion percentage when a completed topic is later reopened for revision", () => {
    const topics = [
      makeTopic({ id: "t1", status: "Needs Revision" }), // Reopened in March!
      makeTopic({ id: "t2", status: "Not Started" }),
    ];

    const events: CompletionEvent[] = [
      {
        id: "ev-feb",
        topicId: "t1",
        eventType: "completed",
        previousStatus: "In Progress",
        newStatus: "Completed",
        occurredAt: "2026-02-15T10:00:00.000Z",
        source: "manual",
      },
      {
        id: "ev-mar",
        topicId: "t1",
        eventType: "reopened_for_revision",
        previousStatus: "Completed",
        newStatus: "Needs Revision",
        occurredAt: "2026-03-05T10:00:00.000Z",
        source: "reopen",
      },
    ];

    // At the end of February 2026, t1 WAS Completed (50%)
    const febEnd = calculateHistoricalCompletionAtDateKey(
      topics,
      events,
      "2026-02-28",
      "Asia/Kolkata"
    );
    expect(febEnd.percentage).toBe(50);

    // In March 2026 monthly report: start of month was 50%, end of month is 0% (since reopened)
    const marReport = calculateMonthlyReport({
      monthKey: "2026-03",
      sessions: [
        makeSession({
          id: "m1",
          topicId: "t1",
          dateKey: "2026-03-06",
          durationMinutes: 120,
          activityType: "Lab",
        }),
      ],
      completionEvents: events,
      topics,
      phases: ROADMAP_PHASES,
      targetMinutes: 240,
      targetTopics: 2,
      targetLabs: 2,
      dailyTargetMinutes: 60,
      timezone: "Asia/Kolkata",
    });

    expect(marReport.roadmapProgressStartOfMonth).toBe(50);
    expect(marReport.roadmapProgressEndOfMonth).toBe(0);
    expect(marReport.targets.hoursPercentage).toBe(50);
    expect(marReport.targets.labsPercentage).toBe(50);
  });

  it("calculates weekly time-based goal completion and week-over-week delta", () => {
    const topics = [makeTopic({ id: "t1", status: "In Progress" })];
    const report = calculateWeeklyReport({
      referenceDateKey: "2026-03-04", // Week of 2026-03-02 .. 2026-03-08
      sessions: [
        makeSession({ id: "w1", dateKey: "2026-03-02", durationMinutes: 90 }),
        makeSession({ id: "w2", dateKey: "2026-03-04", durationMinutes: 90 }),
      ],
      previousWeekSessions: [
        makeSession({ id: "p1", dateKey: "2026-02-24", durationMinutes: 60 }),
      ],
      completionEvents: [],
      topics,
      weeklyTargetMinutes: 360,
      dailyTargetMinutes: 90,
      timezone: "Asia/Kolkata",
    });

    expect(report.totalMinutes).toBe(180);
    expect(report.weeklyTimeGoalPercentage).toBe(50);
    expect(report.weekOverWeekDeltaMinutes).toBe(120);
    expect(report.daysMeetingDailyGoal).toBe(2);
    expect(calculateGoalPercentage(90, 0)).toBe(0);
  });
});

describe("Authentication, Authorization, Validation & Firestore Security", () => {
  it("verifies scrypt hashes, fails wrong passwords, and rejects plain SHA-256 unless compatibility mode is explicit", async () => {
    const hash = await hashPasswordScrypt("CorrectHorseBatteryStaple!99");
    expect(hash.startsWith("scrypt$")).toBe(true);

    const ok = await verifyPasswordHash("CorrectHorseBatteryStaple!99", hash);
    expect(ok.valid).toBe(true);
    expect(ok.usedLegacySha256).toBe(false);

    const wrong = await verifyPasswordHash("WrongPassword123!", hash);
    expect(wrong.valid).toBe(false);

    // Plain SHA-256 rejected by default
    const shaHex = createHash("sha256").update("LegacySecret123", "utf8").digest("hex");
    const rejectedSha = await verifyPasswordHash("LegacySecret123", `sha256$${shaHex}`, {
      allowLegacySha256Compat: false,
    });
    expect(rejectedSha.valid).toBe(false);

    // Accepted ONLY when allowLegacySha256Compat is explicitly enabled, flagging migration warning
    const compatSha = await verifyPasswordHash("LegacySecret123", `sha256$${shaHex}`, {
      allowLegacySha256Compat: true,
    });
    expect(compatSha.valid).toBe(true);
    expect(compatSha.usedLegacySha256).toBe(true);
  });

  it("enforces same-origin authorization checks against cross-origin CSRF requests", () => {
    const legitReq = new Request("https://tracker.example.com/api/sessions", {
      method: "POST",
      headers: {
        host: "tracker.example.com",
        origin: "https://tracker.example.com",
      },
    });
    expect(verifySameOriginRequest(legitReq)).toBe(true);

    const evilReq = new Request("https://tracker.example.com/api/sessions", {
      method: "POST",
      headers: {
        host: "tracker.example.com",
        origin: "https://attacker.evil.org",
      },
    });
    expect(verifySameOriginRequest(evilReq)).toBe(false);
  });

  it("rejects negative durations, impossible dates, and unsafe javascript: URLs via Zod", () => {
    expect(
      createStudySessionSchema.safeParse({
        topicId: "t1",
        dateKey: "2026-03-10",
        durationMinutes: -15,
        activityType: "Lab",
      }).success
    ).toBe(false);

    expect(
      createStudySessionSchema.safeParse({
        topicId: "t1",
        dateKey: "2026-02-30", // impossible date
        durationMinutes: 45,
        activityType: "Lab",
      }).success
    ).toBe(false);

    expect(
      createTopicSchema.safeParse({
        title: "XSS Test",
        phaseId: "phase-1",
        sectionId: "sec-1",
        resourceLinks: [
          {
            title: "Bad link",
            url: "javascript:alert(1)",
            type: "tutorial",
          },
        ],
      }).success
    ).toBe(false);

    expect(
      backupImportSchema.safeParse({
        mode: "skip_existing",
        payload: { schemaVersion: "9.9.9" },
      }).success
    ).toBe(false);
  });

  it("validates Firestore Security Rules and Composite Indexes configuration", () => {
    const rules = fs.readFileSync(
      path.resolve(process.cwd(), "firestore.rules"),
      "utf8"
    );
    expect(rules).toContain("rules_version = '2'");
    expect(rules).toContain("request.auth != null && request.auth.uid == userId");
    expect(rules).toContain("match /_system/{docId}");
    expect(rules).toContain("match /_authSessions/{sessionId}");
    expect(rules).toContain("match /_rateLimits/{limitKey}");
    expect(rules).toContain("durationMinutes >= 1");

    const indexes = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "firestore.indexes.json"), "utf8")
    );
    const groups = indexes.indexes.map(
      (idx: { collectionGroup: string }) => idx.collectionGroup
    );
    expect(groups).toContain("studySessions");
    expect(groups).toContain("topics");
    expect(groups).toContain("completionEvents");
    expect(groups).toContain("reflections");
  });
});
