import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isDuplicateSessionSubmission } from "@/lib/analytics";
import { requireApiAuth } from "@/lib/auth/session";
import { isValidDateKey } from "@/lib/dates";
import { getRepository } from "@/lib/storage";
import type { StudySession } from "@/lib/types";
import { createStudySessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const startDateKey = url.searchParams.get("startDateKey") || undefined;
    const endDateKey = url.searchParams.get("endDateKey") || undefined;
    const topicId = url.searchParams.get("topicId") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(1000, Math.max(1, Number(limitParam))) : undefined;

    if (startDateKey && !isValidDateKey(startDateKey)) {
      return NextResponse.json(
        { error: "Invalid startDateKey." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (endDateKey && !isValidDateKey(endDateKey)) {
      return NextResponse.json(
        { error: "Invalid endDateKey." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repo = getRepository();
    const sessions = await repo.listSessions(auth.session.userId, {
      startDateKey,
      endDateKey,
      topicId,
      limit,
    });

    return NextResponse.json(
      { sessions },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load study sessions." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = createStudySessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid session data." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = parsed.data;
    const repo = getRepository();

    const topic = await repo.getTopic(auth.session.userId, data.topicId);
    if (!topic) {
      return NextResponse.json(
        { error: "Referenced topic does not exist." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const existingOnDay = await repo.listSessions(auth.session.userId, {
      startDateKey: data.dateKey,
      endDateKey: data.dateKey,
    });

    if (
      isDuplicateSessionSubmission(existingOnDay, {
        topicId: data.topicId,
        dateKey: data.dateKey,
        startedAt: data.startedAt ?? null,
        durationMinutes: data.durationMinutes,
        activityType: data.activityType,
        notes: data.notes,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "Duplicate session submission detected. This study session was just recorded.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const nowIso = new Date().toISOString();
    const session: StudySession = {
      id: `sess-${randomBytes(8).toString("hex")}`,
      topicId: data.topicId,
      dateKey: data.dateKey,
      startedAt: data.startedAt ?? null,
      durationMinutes: data.durationMinutes,
      activityType: data.activityType,
      notes: data.notes,
      outcome: data.outcome,
      confidence: data.confidence,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await repo.saveSession(auth.session.userId, session);

    // If topic was "Not Started", move it to "In Progress" automatically (never auto-recompleting Completed topics!)
    if (topic.status === "Not Started") {
      await repo.saveTopic(auth.session.userId, {
        ...topic,
        status: "In Progress",
        confidence: topic.confidence === 0 ? data.confidence : topic.confidence,
        updatedAt: nowIso,
      });
      await repo.recordCompletionEvent(auth.session.userId, {
        id: `ev-${randomBytes(8).toString("hex")}`,
        topicId: topic.id,
        eventType: "status_changed",
        previousStatus: "Not Started",
        newStatus: "In Progress",
        occurredAt: nowIso,
        source: "session",
      });
    }

    return NextResponse.json(
      { session },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to record study session." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
