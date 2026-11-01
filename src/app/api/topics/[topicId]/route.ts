import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";
import type { CompletionEvent, CompletionEventType, Topic } from "@/lib/types";
import { updateTopicSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { topicId } = await context.params;
    const repo = getRepository();
    const topic = await repo.getTopic(auth.session.userId, topicId);
    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const [allTopics, sessions, completionEvents, impact] = await Promise.all([
      repo.listTopics(auth.session.userId),
      repo.listSessions(auth.session.userId, { topicId }),
      repo.listCompletionEvents(auth.session.userId, { topicId }),
      repo.countTopicAssociatedRecords(auth.session.userId, topicId),
    ]);

    const subtopics = allTopics.filter((t) => t.parentTopicId === topicId);

    return NextResponse.json(
      {
        topic,
        subtopics,
        sessions,
        completionEvents,
        impact,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch topic details." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { topicId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateTopicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repo = getRepository();
    const existing = await repo.getTopic(auth.session.userId, topicId);
    if (!existing) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const patch = parsed.data;
    const nowIso = new Date().toISOString();

    const nextStatus = patch.reopenForRevision
      ? "Needs Revision"
      : patch.status ?? existing.status;

    const statusChanged = nextStatus !== existing.status;

    let completedAt = existing.completedAt;
    if (statusChanged && nextStatus === "Completed") {
      completedAt = nowIso;
    } else if (nextStatus === "Not Started") {
      completedAt = null;
    }
    // Note: Reopening a completed topic for revision preserves previous CompletionEvents
    // and keeps original completedAt history in CompletionEvents without fabricating a new completion!

    const { reopenForRevision: _ignoredReopen, ...cleanPatch } = patch;
    void _ignoredReopen;

    const updated: Topic = {
      ...existing,
      ...cleanPatch,
      status: nextStatus,
      completedAt,
      updatedAt: nowIso,
    };

    await repo.saveTopic(auth.session.userId, updated);

    let recordedEvent: CompletionEvent | null = null;
    if (statusChanged) {
      let eventType: CompletionEventType = "status_changed";
      if (nextStatus === "Completed") {
        eventType = "completed";
      } else if (
        patch.reopenForRevision ||
        (existing.status === "Completed" && nextStatus === "Needs Revision")
      ) {
        eventType = "reopened_for_revision";
      } else if (nextStatus === "Not Started") {
        eventType = "reset";
      }

      recordedEvent = {
        id: `ev-${randomBytes(8).toString("hex")}`,
        topicId,
        eventType,
        previousStatus: existing.status,
        newStatus: nextStatus,
        occurredAt: nowIso,
        source: patch.reopenForRevision ? "reopen" : "manual",
      };
      await repo.recordCompletionEvent(auth.session.userId, recordedEvent);
    }

    return NextResponse.json(
      { topic: updated, completionEvent: recordedEvent },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update topic." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { topicId } = await context.params;
    const url = new URL(request.url);
    const deleteRecords = url.searchParams.get("deleteRecords") === "true";

    const repo = getRepository();
    const existing = await repo.getTopic(auth.session.userId, topicId);
    if (!existing) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await repo.deleteTopic(
      auth.session.userId,
      topicId,
      deleteRecords
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to delete topic." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
