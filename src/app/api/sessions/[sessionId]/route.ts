import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { getRepository } from "@/lib/storage";
import type { StudySession } from "@/lib/types";
import { updateStudySessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateStudySessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid session update." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repo = getRepository();
    const existing = await repo.getSession(auth.session.userId, sessionId);
    if (!existing) {
      return NextResponse.json(
        { error: "Study session not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const patch = parsed.data;
    if (patch.topicId && patch.topicId !== existing.topicId) {
      const topic = await repo.getTopic(auth.session.userId, patch.topicId);
      if (!topic) {
        return NextResponse.json(
          { error: "Referenced topic does not exist." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const updated: StudySession = {
      ...existing,
      topicId: patch.topicId ?? existing.topicId,
      dateKey: patch.dateKey ?? existing.dateKey,
      startedAt:
        patch.startedAt !== undefined ? patch.startedAt : existing.startedAt,
      durationMinutes: patch.durationMinutes ?? existing.durationMinutes,
      activityType: patch.activityType ?? existing.activityType,
      notes: patch.notes ?? existing.notes,
      outcome: patch.outcome ?? existing.outcome,
      confidence: patch.confidence ?? existing.confidence,
      updatedAt: new Date().toISOString(),
    };

    // Updates the exact session ID in place so totals recalculate cleanly without double-counting
    await repo.saveSession(auth.session.userId, updated);

    return NextResponse.json(
      { session: updated },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update study session." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { sessionId } = await context.params;
    const repo = getRepository();
    const deleted = await repo.deleteSession(auth.session.userId, sessionId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Study session not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to delete study session." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
