import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";
import type { BackupPayload } from "@/lib/types";
import { backupImportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  // Mitigate spreadsheet formula injection (=, +, -, @, tab, CR)
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const repo = getRepository();

    if (format === "sessions_csv") {
      const [sessions, topics] = await Promise.all([
        repo.listSessions(auth.session.userId),
        repo.listTopics(auth.session.userId),
      ]);
      const topicMap = new Map(topics.map((t) => [t.id, t]));
      const csv = toCsv(
        [
          "Session ID",
          "Date",
          "Start Time",
          "Duration (Minutes)",
          "Activity Type",
          "Topic ID",
          "Topic Title",
          "Phase ID",
          "Confidence (1-5)",
          "Outcome",
          "Notes",
          "Created At",
        ],
        sessions.map((s) => {
          const t = topicMap.get(s.topicId);
          return [
            s.id,
            s.dateKey,
            s.startedAt ?? "",
            s.durationMinutes,
            s.activityType,
            s.topicId,
            t?.title ?? "Deleted Topic",
            t?.phaseId ?? "",
            s.confidence,
            s.outcome,
            s.notes,
            s.createdAt,
          ];
        })
      );

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cybersec-study-sessions-${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "topics_csv") {
      const topics = await repo.listTopics(auth.session.userId);
      const csv = toCsv(
        [
          "Topic ID",
          "Title",
          "Type",
          "Phase ID",
          "Section ID",
          "Parent Topic ID",
          "Status",
          "Priority",
          "Difficulty",
          "Estimated Duration",
          "Estimated Minutes",
          "Confidence (0-5)",
          "Planned Date",
          "Completed At",
          "Next Action",
          "Updated At",
        ],
        topics.map((t) => [
          t.id,
          t.title,
          t.parentTopicId ? "Subtopic" : "Topic",
          t.phaseId,
          t.sectionId,
          t.parentTopicId ?? "",
          t.status,
          t.priority,
          t.difficulty,
          t.estimatedDuration,
          t.estimatedMinutes,
          t.confidence,
          t.plannedDate ?? "",
          t.completedAt ?? "",
          t.nextAction,
          t.updatedAt,
        ])
      );

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cybersec-topics-progress-${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const [
      settings,
      topics,
      studySessions,
      completionEvents,
      goals,
      reflections,
    ] = await Promise.all([
      repo.getSettings(auth.session.userId),
      repo.listTopics(auth.session.userId),
      repo.listSessions(auth.session.userId),
      repo.listCompletionEvents(auth.session.userId),
      repo.listGoals(auth.session.userId),
      repo.listReflections(auth.session.userId),
    ]);

    const payload: BackupPayload = {
      schemaVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      sourceApplication: "Cybersecurity Learning Tracker",
      settings,
      topics,
      studySessions,
      completionEvents,
      goals,
      reflections,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cybersec-tracker-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate data export." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = backupImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Backup file failed schema validation.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { mode, payload } = parsed.data;
    const repo = getRepository();
    const userId = auth.session.userId;

    const [
      existingTopics,
      existingSessions,
      existingEvents,
      existingGoals,
      existingReflections,
    ] = await Promise.all([
      repo.listTopics(userId),
      repo.listSessions(userId),
      repo.listCompletionEvents(userId),
      repo.listGoals(userId),
      repo.listReflections(userId),
    ]);

    const existingTopicIds = new Set(existingTopics.map((t) => t.id));
    const existingSessionIds = new Set(existingSessions.map((s) => s.id));
    const existingEventIds = new Set(existingEvents.map((e) => e.id));
    const existingGoalIds = new Set(existingGoals.map((g) => g.id));
    const existingReflectionIds = new Set(existingReflections.map((r) => r.id));

    const topicsToSave =
      mode === "merge"
        ? payload.topics
        : payload.topics.filter((t) => !existingTopicIds.has(t.id));

    // Only import sessions whose topicId exists in existing or imported topics
    const validTopicIds = new Set([
      ...existingTopicIds,
      ...payload.topics.map((t) => t.id),
    ]);

    const sessionsToSave = (
      mode === "merge"
        ? payload.studySessions
        : payload.studySessions.filter((s) => !existingSessionIds.has(s.id))
    ).filter((s) => validTopicIds.has(s.topicId));

    const eventsToSave = (
      mode === "merge"
        ? payload.completionEvents
        : payload.completionEvents.filter((e) => !existingEventIds.has(e.id))
    ).filter((e) => validTopicIds.has(e.topicId));

    const goalsToSave =
      mode === "merge"
        ? payload.goals
        : payload.goals.filter((g) => !existingGoalIds.has(g.id));

    const reflectionsToSave =
      mode === "merge"
        ? payload.reflections
        : payload.reflections.filter((r) => !existingReflectionIds.has(r.id));

    if (topicsToSave.length > 0) {
      await repo.upsertTopicsBatch(userId, topicsToSave);
    }
    if (sessionsToSave.length > 0) {
      await repo.saveSessionsBatch(userId, sessionsToSave);
    }
    if (eventsToSave.length > 0) {
      await repo.recordCompletionEventsBatch(userId, eventsToSave);
    }
    for (const g of goalsToSave) {
      await repo.upsertGoal(userId, g);
    }
    for (const r of reflectionsToSave) {
      await repo.upsertReflection(userId, r);
    }
    if (mode === "merge" && payload.settings) {
      await repo.updateSettings(userId, payload.settings);
    }

    return NextResponse.json(
      {
        ok: true,
        imported: {
          topics: topicsToSave.length,
          studySessions: sessionsToSave.length,
          completionEvents: eventsToSave.length,
          goals: goalsToSave.length,
          reflections: reflectionsToSave.length,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to import backup payload." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
