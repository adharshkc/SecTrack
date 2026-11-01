import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import {
  CANONICAL_ROADMAP,
  getPhaseById,
  getSectionById,
  ROADMAP_PHASES,
  ROADMAP_SECTIONS,
} from "@/lib/roadmap-data";
import { getRepository } from "@/lib/storage";
import type { CompletionEvent, Topic } from "@/lib/types";
import { createTopicSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const repo = getRepository();
    const topics = await repo.listTopics(auth.session.userId);
    return NextResponse.json(
      {
        sourceUrl: CANONICAL_ROADMAP.sourceUrl,
        lastReviewedAt: CANONICAL_ROADMAP.lastReviewedAt,
        phases: ROADMAP_PHASES,
        sections: ROADMAP_SECTIONS,
        topics,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load topics." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = createTopicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid topic data." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = parsed.data;
    if (!getPhaseById(data.phaseId) || !getSectionById(data.sectionId)) {
      return NextResponse.json(
        { error: "Invalid phaseId or sectionId." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repo = getRepository();
    if (data.parentTopicId) {
      const parent = await repo.getTopic(auth.session.userId, data.parentTopicId);
      if (!parent) {
        return NextResponse.json(
          { error: "Parent topic does not exist." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const existing = await repo.listTopics(auth.session.userId);
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), 0);
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    const id = `${data.parentTopicId ? "custom-sub" : "custom-top"}-${slug}-${randomBytes(3).toString("hex")}`;
    const nowIso = new Date().toISOString();

    const topic: Topic = {
      id,
      title: data.title,
      description: data.description,
      phaseId: data.phaseId,
      sectionId: data.sectionId,
      parentTopicId: data.parentTopicId ?? null,
      order: data.order ?? maxOrder + 10,
      status: data.status ?? "Not Started",
      priority: data.priority,
      difficulty: data.difficulty,
      estimatedDuration: data.estimatedDuration,
      estimatedMinutes: data.estimatedMinutes,
      prerequisites: data.prerequisites,
      resourceLinks: data.resourceLinks,
      practicalExercises: data.practicalExercises,
      completedExercises: [],
      learningObjectives: data.learningObjectives,
      completedObjectives: [],
      tools: data.tools,
      notes: data.notes,
      commandsLearned: data.commandsLearned,
      questionsToRevisit: data.questionsToRevisit,
      confidence: data.confidence,
      nextAction: data.nextAction,
      plannedDate: data.plannedDate,
      isCustom: true,
      isTrackable: true,
      sourceUrl: "manual",
      lastReviewedAt: nowIso.slice(0, 10),
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: data.status === "Completed" ? nowIso : null,
    };

    await repo.saveTopic(auth.session.userId, topic);

    if (topic.status !== "Not Started") {
      const ev: CompletionEvent = {
        id: `ev-${randomBytes(8).toString("hex")}`,
        topicId: topic.id,
        eventType: topic.status === "Completed" ? "completed" : "status_changed",
        previousStatus: null,
        newStatus: topic.status,
        occurredAt: nowIso,
        source: "manual",
      };
      await repo.recordCompletionEvent(auth.session.userId, ev);
    }

    return NextResponse.json(
      { topic },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create topic." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
