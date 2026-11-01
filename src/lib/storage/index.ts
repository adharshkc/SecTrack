import "server-only";
import { isPostgresConfigured } from "@/db";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { CANONICAL_ROADMAP } from "@/lib/roadmap-data";
import type { Topic } from "@/lib/types";
import { FirestoreRepository } from "./firestore-repo";
import { PostgresRepository } from "./postgres-repo";
import type { LearningRepository } from "./types";

let singletonRepo: LearningRepository | null = null;

export function getRepository(): LearningRepository {
  if (singletonRepo) return singletonRepo;

  const explicitBackend = process.env.STORAGE_BACKEND?.toLowerCase();
  if (explicitBackend === "firestore") {
    singletonRepo = new FirestoreRepository();
    return singletonRepo;
  }
  if (explicitBackend === "postgres") {
    singletonRepo = new PostgresRepository();
    return singletonRepo;
  }

  if (isFirebaseAdminConfigured()) {
    singletonRepo = new FirestoreRepository();
    return singletonRepo;
  }

  if (isPostgresConfigured()) {
    singletonRepo = new PostgresRepository();
    return singletonRepo;
  }

  throw new Error(
    "No database storage provider is configured. Configure Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) or DATABASE_URL."
  );
}

/**
 * Repeatable, idempotent roadmap seeding / sync process:
 * 1. Preserves source hierarchy (5 phases -> 12 sections -> 36 topics -> 160 subtopics)
 * 2. Uses stable deterministic IDs
 * 3. Avoids duplicate entries when run more than once
 * 4. Preserves existing user status, notes, confidence, completedAt, exercises, objectives, and custom topics
 * 5. Records sourceUrl ("https://www.itshahirx.com/roadmap") and lastReviewedAt ("2026-03-01")
 */
export async function syncRoadmapForUser(
  userId: string,
  options: { force?: boolean } = {}
): Promise<{ created: number; updated: number; preservedCustom: number }> {
  const repo = getRepository();
  const settings = await repo.getSettings(userId);
  const existingTopics = await repo.listTopics(userId);

  if (
    !options.force &&
    settings.roadmapSeededVersion === CANONICAL_ROADMAP.schemaVersion &&
    existingTopics.length > 0
  ) {
    return {
      created: 0,
      updated: 0,
      preservedCustom: existingTopics.filter((t) => t.isCustom).length,
    };
  }

  const existingMap = new Map(existingTopics.map((t) => [t.id, t]));
  const nowIso = new Date().toISOString();
  const toUpsert: Topic[] = [];
  let created = 0;
  let updated = 0;

  for (const seed of CANONICAL_ROADMAP.topics) {
    const existing = existingMap.get(seed.id);
    if (!existing) {
      created++;
      toUpsert.push({
        id: seed.id,
        title: seed.title,
        description: seed.description,
        phaseId: seed.phaseId,
        sectionId: seed.sectionId,
        parentTopicId: seed.parentTopicId,
        order: seed.order,
        status: "Not Started",
        priority: seed.priority,
        difficulty: seed.difficulty,
        estimatedDuration: seed.estimatedDuration,
        estimatedMinutes: seed.estimatedMinutes,
        prerequisites: seed.prerequisites,
        resourceLinks: seed.resourceLinks,
        practicalExercises: seed.practicalExercises,
        completedExercises: [],
        learningObjectives: seed.learningObjectives,
        completedObjectives: [],
        tools: seed.tools,
        notes: "",
        commandsLearned: "",
        questionsToRevisit: "",
        confidence: 0,
        nextAction: "",
        plannedDate: null,
        isCustom: false,
        isTrackable: true,
        sourceUrl: CANONICAL_ROADMAP.sourceUrl,
        lastReviewedAt: CANONICAL_ROADMAP.lastReviewedAt,
        createdAt: nowIso,
        updatedAt: nowIso,
        completedAt: null,
      });
    } else {
      updated++;
      // Strictly preserve user progress, status, notes, confidence, completedAt, and custom edits
      toUpsert.push({
        ...existing,
        phaseId: existing.phaseId || seed.phaseId,
        sectionId: existing.sectionId || seed.sectionId,
        parentTopicId: existing.parentTopicId ?? seed.parentTopicId,
        order: existing.order ?? seed.order,
        prerequisites:
          existing.prerequisites.length > 0
            ? existing.prerequisites
            : seed.prerequisites,
        resourceLinks:
          existing.resourceLinks.length > 0
            ? existing.resourceLinks
            : seed.resourceLinks,
        practicalExercises:
          existing.practicalExercises.length > 0
            ? existing.practicalExercises
            : seed.practicalExercises,
        learningObjectives:
          existing.learningObjectives.length > 0
            ? existing.learningObjectives
            : seed.learningObjectives,
        tools: existing.tools.length > 0 ? existing.tools : seed.tools,
        sourceUrl: CANONICAL_ROADMAP.sourceUrl,
        lastReviewedAt: CANONICAL_ROADMAP.lastReviewedAt,
      });
    }
  }

  if (toUpsert.length > 0) {
    await repo.upsertTopicsBatch(userId, toUpsert);
  }

  await repo.updateSettings(userId, {
    roadmapSeededVersion: CANONICAL_ROADMAP.schemaVersion,
    roadmapSourceUrl: CANONICAL_ROADMAP.sourceUrl,
    roadmapLastSyncedAt: nowIso,
  });

  return {
    created,
    updated,
    preservedCustom: existingTopics.filter((t) => t.isCustom).length,
  };
}
