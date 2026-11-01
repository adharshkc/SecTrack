import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  authSessionsTable,
  completionEventsTable,
  goalsTable,
  ownerVaultTable,
  rateLimitsTable,
  reflectionsTable,
  studySessionsTable,
  topicsTable,
  userSettingsTable,
} from "@/db/schema";
import { DEFAULT_TIMEZONE } from "@/lib/types";
import type {
  ActivityType,
  CompletionEvent,
  CompletionEventType,
  Goal,
  GoalPeriodType,
  Reflection,
  ReflectionPeriodType,
  StudySession,
  Topic,
  TopicDifficulty,
  TopicPriority,
  TopicStatus,
  UserSettings,
} from "@/lib/types";
import type {
  EventQueryOptions,
  LearningRepository,
  RateLimitState,
  SessionQueryOptions,
  StoredAuthSession,
  StoredOwnerVault,
} from "./types";

function mapTopicRow(row: typeof topicsTable.$inferSelect): Topic {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    phaseId: row.phaseId,
    sectionId: row.sectionId,
    parentTopicId: row.parentTopicId,
    order: row.order,
    status: row.status as TopicStatus,
    priority: row.priority as TopicPriority,
    difficulty: row.difficulty as TopicDifficulty,
    estimatedDuration: row.estimatedDuration,
    estimatedMinutes: row.estimatedMinutes,
    prerequisites: row.prerequisites ?? [],
    resourceLinks: row.resourceLinks ?? [],
    practicalExercises: row.practicalExercises ?? [],
    completedExercises: row.completedExercises ?? [],
    learningObjectives: row.learningObjectives ?? [],
    completedObjectives: row.completedObjectives ?? [],
    tools: row.tools ?? [],
    notes: row.notes,
    commandsLearned: row.commandsLearned,
    questionsToRevisit: row.questionsToRevisit,
    confidence: row.confidence,
    nextAction: row.nextAction,
    plannedDate: row.plannedDate,
    isCustom: row.isCustom,
    isTrackable: row.isTrackable,
    sourceUrl: row.sourceUrl,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

function mapSessionRow(row: typeof studySessionsTable.$inferSelect): StudySession {
  return {
    id: row.id,
    topicId: row.topicId,
    dateKey: row.dateKey,
    startedAt: row.startedAt,
    durationMinutes: row.durationMinutes,
    activityType: row.activityType as ActivityType,
    notes: row.notes,
    outcome: row.outcome,
    confidence: row.confidence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEventRow(row: typeof completionEventsTable.$inferSelect): CompletionEvent {
  return {
    id: row.id,
    topicId: row.topicId,
    eventType: row.eventType as CompletionEventType,
    previousStatus: (row.previousStatus as TopicStatus | null) ?? null,
    newStatus: row.newStatus as TopicStatus,
    occurredAt: row.occurredAt,
    source: row.source as CompletionEvent["source"],
  };
}

export class PostgresRepository implements LearningRepository {
  readonly providerName = "postgres" as const;

  async getOwnerVault(): Promise<StoredOwnerVault | null> {
    const rows = await db
      .select()
      .from(ownerVaultTable)
      .where(eq(ownerVaultTable.id, "singleton"))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      ownerUid: r.ownerUid,
      ownerEmail: r.ownerEmail,
      passwordHash: r.passwordHash,
      sessionSecret: r.sessionSecret,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async saveOwnerVault(vault: StoredOwnerVault): Promise<StoredOwnerVault> {
    const now = new Date();
    await db
      .insert(ownerVaultTable)
      .values({
        id: "singleton",
        ownerUid: vault.ownerUid,
        ownerEmail: vault.ownerEmail,
        passwordHash: vault.passwordHash,
        sessionSecret: vault.sessionSecret,
        createdAt: new Date(vault.createdAt),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: ownerVaultTable.id,
        set: {
          ownerUid: vault.ownerUid,
          ownerEmail: vault.ownerEmail,
          passwordHash: vault.passwordHash,
          sessionSecret: vault.sessionSecret,
          updatedAt: now,
        },
      });
    return { ...vault, updatedAt: now.toISOString() };
  }

  async createAuthSession(session: StoredAuthSession): Promise<void> {
    await db.insert(authSessionsTable).values({
      id: session.id,
      userId: session.userId,
      csrfToken: session.csrfToken,
      authMethod: session.authMethod,
      expiresAt: new Date(session.expiresAt),
      revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      createdAt: new Date(session.createdAt),
    });
  }

  async getAuthSession(sessionId: string): Promise<StoredAuthSession | null> {
    const rows = await db
      .select()
      .from(authSessionsTable)
      .where(eq(authSessionsTable.id, sessionId))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      csrfToken: r.csrfToken,
      authMethod: r.authMethod as StoredAuthSession["authMethod"],
      expiresAt: r.expiresAt.toISOString(),
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    await db
      .update(authSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(authSessionsTable.id, sessionId));
  }

  async checkAndIncrementRateLimit(
    key: string,
    maxAttempts: number,
    windowMs: number
  ): Promise<RateLimitState> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const nowMs = now.getTime();
      await tx
        .insert(rateLimitsTable)
        .values({ key, attempts: 0, windowStartedAt: now, blockedUntil: null })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(rateLimitsTable)
        .where(eq(rateLimitsTable.key, key))
        .for("update")
        .limit(1);

      if (row.blockedUntil && row.blockedUntil.getTime() > nowMs) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - nowMs) / 1000),
        };
      }

      if (nowMs - row.windowStartedAt.getTime() > windowMs) {
        await tx.update(rateLimitsTable)
          .set({ attempts: 1, windowStartedAt: now, blockedUntil: null })
          .where(eq(rateLimitsTable.key, key));
        return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
      }

      const nextAttempts = row.attempts + 1;
      if (nextAttempts > maxAttempts) {
        const blockedUntil = new Date(nowMs + windowMs);
        await tx.update(rateLimitsTable)
          .set({ attempts: nextAttempts, blockedUntil })
          .where(eq(rateLimitsTable.key, key));
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        };
      }

      await tx.update(rateLimitsTable)
        .set({ attempts: nextAttempts })
        .where(eq(rateLimitsTable.key, key));
      return {
        allowed: true,
        remaining: Math.max(0, maxAttempts - nextAttempts),
        retryAfterSeconds: 0,
      };
    });
  }

  async resetRateLimit(key: string): Promise<void> {
    await db.delete(rateLimitsTable).where(eq(rateLimitsTable.key, key));
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const rows = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);
    if (rows.length === 0) {
      const nowIso = new Date().toISOString();
      const initial: UserSettings = {
        id: "preferences",
        timezone: DEFAULT_TIMEZONE,
        dailyTargetMinutes: 90,
        weeklyTargetMinutes: 540,
        monthlyTargetMinutes: 2400,
        monthlyTargetTopics: 4,
        monthlyTargetLabs: 8,
        roadmapSeededVersion: null,
        roadmapSourceUrl: "https://www.itshahirx.com/roadmap",
        roadmapLastSyncedAt: null,
        theme: "dark",
        updatedAt: nowIso,
      };
      await db
        .insert(userSettingsTable)
        .values({
          userId,
          timezone: initial.timezone,
          dailyTargetMinutes: initial.dailyTargetMinutes,
          weeklyTargetMinutes: initial.weeklyTargetMinutes,
          monthlyTargetMinutes: initial.monthlyTargetMinutes,
          monthlyTargetTopics: initial.monthlyTargetTopics,
          monthlyTargetLabs: initial.monthlyTargetLabs,
          roadmapSeededVersion: initial.roadmapSeededVersion,
          roadmapSourceUrl: initial.roadmapSourceUrl,
          roadmapLastSyncedAt: initial.roadmapLastSyncedAt,
          theme: initial.theme,
          updatedAt: nowIso,
        })
        .onConflictDoNothing();
      return initial;
    }

    const r = rows[0];
    return {
      id: "preferences",
      timezone: r.timezone,
      dailyTargetMinutes: r.dailyTargetMinutes,
      weeklyTargetMinutes: r.weeklyTargetMinutes,
      monthlyTargetMinutes: r.monthlyTargetMinutes,
      monthlyTargetTopics: r.monthlyTargetTopics,
      monthlyTargetLabs: r.monthlyTargetLabs,
      roadmapSeededVersion: r.roadmapSeededVersion,
      roadmapSourceUrl: r.roadmapSourceUrl,
      roadmapLastSyncedAt: r.roadmapLastSyncedAt,
      theme: (r.theme === "light" ? "light" : "dark") as "dark" | "light",
      updatedAt: r.updatedAt,
    };
  }

  async updateSettings(
    userId: string,
    patch: Partial<UserSettings>
  ): Promise<UserSettings> {
    const current = await this.getSettings(userId);
    const updated: UserSettings = {
      ...current,
      ...patch,
      id: "preferences",
      updatedAt: new Date().toISOString(),
    };
    await db
      .insert(userSettingsTable)
      .values({
        userId,
        timezone: updated.timezone,
        dailyTargetMinutes: updated.dailyTargetMinutes,
        weeklyTargetMinutes: updated.weeklyTargetMinutes,
        monthlyTargetMinutes: updated.monthlyTargetMinutes,
        monthlyTargetTopics: updated.monthlyTargetTopics,
        monthlyTargetLabs: updated.monthlyTargetLabs,
        roadmapSeededVersion: updated.roadmapSeededVersion,
        roadmapSourceUrl: updated.roadmapSourceUrl,
        roadmapLastSyncedAt: updated.roadmapLastSyncedAt,
        theme: updated.theme,
        updatedAt: updated.updatedAt,
      })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: {
          timezone: updated.timezone,
          dailyTargetMinutes: updated.dailyTargetMinutes,
          weeklyTargetMinutes: updated.weeklyTargetMinutes,
          monthlyTargetMinutes: updated.monthlyTargetMinutes,
          monthlyTargetTopics: updated.monthlyTargetTopics,
          monthlyTargetLabs: updated.monthlyTargetLabs,
          roadmapSeededVersion: updated.roadmapSeededVersion,
          roadmapSourceUrl: updated.roadmapSourceUrl,
          roadmapLastSyncedAt: updated.roadmapLastSyncedAt,
          theme: updated.theme,
          updatedAt: updated.updatedAt,
        },
      });
    return updated;
  }

  async listTopics(userId: string): Promise<Topic[]> {
    const rows = await db
      .select()
      .from(topicsTable)
      .where(eq(topicsTable.userId, userId))
      .orderBy(asc(topicsTable.order));
    return rows.map(mapTopicRow);
  }

  async getTopic(userId: string, topicId: string): Promise<Topic | null> {
    const rows = await db
      .select()
      .from(topicsTable)
      .where(and(eq(topicsTable.userId, userId), eq(topicsTable.id, topicId)))
      .limit(1);
    return rows.length > 0 ? mapTopicRow(rows[0]) : null;
  }

  async upsertTopicsBatch(userId: string, topics: Topic[]): Promise<void> {
    if (topics.length === 0) return;
    for (let i = 0; i < topics.length; i += 100) {
      const slice = topics.slice(i, i + 100);
      for (const topic of slice) {
        await this.saveTopic(userId, topic);
      }
    }
  }

  async saveTopic(userId: string, topic: Topic): Promise<Topic> {
    const row = {
      userId,
      id: topic.id,
      title: topic.title,
      description: topic.description,
      phaseId: topic.phaseId,
      sectionId: topic.sectionId,
      parentTopicId: topic.parentTopicId,
      order: topic.order,
      status: topic.status,
      priority: topic.priority,
      difficulty: topic.difficulty,
      estimatedDuration: topic.estimatedDuration,
      estimatedMinutes: topic.estimatedMinutes,
      prerequisites: topic.prerequisites,
      resourceLinks: topic.resourceLinks,
      practicalExercises: topic.practicalExercises,
      completedExercises: topic.completedExercises,
      learningObjectives: topic.learningObjectives,
      completedObjectives: topic.completedObjectives,
      tools: topic.tools,
      notes: topic.notes,
      commandsLearned: topic.commandsLearned,
      questionsToRevisit: topic.questionsToRevisit,
      confidence: topic.confidence,
      nextAction: topic.nextAction,
      plannedDate: topic.plannedDate,
      isCustom: topic.isCustom,
      isTrackable: topic.isTrackable,
      sourceUrl: topic.sourceUrl,
      lastReviewedAt: topic.lastReviewedAt,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      completedAt: topic.completedAt,
    };

    await db
      .insert(topicsTable)
      .values(row)
      .onConflictDoUpdate({
        target: [topicsTable.userId, topicsTable.id],
        set: row,
      });
    return topic;
  }

  async countTopicAssociatedRecords(userId: string, topicId: string) {
    const [subs, sessions, events] = await Promise.all([
      db
        .select({ id: topicsTable.id })
        .from(topicsTable)
        .where(
          and(
            eq(topicsTable.userId, userId),
            eq(topicsTable.parentTopicId, topicId)
          )
        ),
      db
        .select({ id: studySessionsTable.id })
        .from(studySessionsTable)
        .where(
          and(
            eq(studySessionsTable.userId, userId),
            eq(studySessionsTable.topicId, topicId)
          )
        ),
      db
        .select({ id: completionEventsTable.id })
        .from(completionEventsTable)
        .where(
          and(
            eq(completionEventsTable.userId, userId),
            eq(completionEventsTable.topicId, topicId)
          )
        ),
    ]);
    return {
      subtopics: subs.length,
      sessions: sessions.length,
      events: events.length,
    };
  }

  async deleteTopic(
    userId: string,
    topicId: string,
    deleteAssociatedRecords: boolean = false
  ) {
    const subs = await db
      .select({ id: topicsTable.id })
      .from(topicsTable)
      .where(
        and(eq(topicsTable.userId, userId), eq(topicsTable.parentTopicId, topicId))
      );

    const targetIds = [topicId, ...subs.map((s) => s.id)];
    let deletedSessions = 0;
    let deletedEvents = 0;

    if (deleteAssociatedRecords) {
      const sessRows = await db
        .delete(studySessionsTable)
        .where(
          and(
            eq(studySessionsTable.userId, userId),
            inArray(studySessionsTable.topicId, targetIds)
          )
        )
        .returning({ id: studySessionsTable.id });
      deletedSessions = sessRows.length;

      const evRows = await db
        .delete(completionEventsTable)
        .where(
          and(
            eq(completionEventsTable.userId, userId),
            inArray(completionEventsTable.topicId, targetIds)
          )
        )
        .returning({ id: completionEventsTable.id });
      deletedEvents = evRows.length;
    }

    await db
      .delete(topicsTable)
      .where(
        and(eq(topicsTable.userId, userId), inArray(topicsTable.id, targetIds))
      );

    return {
      deletedSubtopics: subs.length,
      deletedSessions,
      deletedEvents,
    };
  }

  async listSessions(
    userId: string,
    options?: SessionQueryOptions
  ): Promise<StudySession[]> {
    const conditions = [eq(studySessionsTable.userId, userId)];
    if (options?.topicId) {
      conditions.push(eq(studySessionsTable.topicId, options.topicId));
    }
    if (options?.startDateKey) {
      conditions.push(gte(studySessionsTable.dateKey, options.startDateKey));
    }
    if (options?.endDateKey) {
      conditions.push(lte(studySessionsTable.dateKey, options.endDateKey));
    }

    const base = db
      .select()
      .from(studySessionsTable)
      .where(and(...conditions))
      .orderBy(desc(studySessionsTable.dateKey), desc(studySessionsTable.createdAt));

    const rows = options?.limit ? await base.limit(options.limit) : await base;
    return rows.map(mapSessionRow);
  }

  async getSession(userId: string, sessionId: string): Promise<StudySession | null> {
    const rows = await db
      .select()
      .from(studySessionsTable)
      .where(
        and(
          eq(studySessionsTable.userId, userId),
          eq(studySessionsTable.id, sessionId)
        )
      )
      .limit(1);
    return rows.length > 0 ? mapSessionRow(rows[0]) : null;
  }

  async saveSession(userId: string, session: StudySession): Promise<StudySession> {
    const row = {
      userId,
      id: session.id,
      topicId: session.topicId,
      dateKey: session.dateKey,
      startedAt: session.startedAt,
      durationMinutes: session.durationMinutes,
      activityType: session.activityType,
      notes: session.notes,
      outcome: session.outcome,
      confidence: session.confidence,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
    await db
      .insert(studySessionsTable)
      .values(row)
      .onConflictDoUpdate({
        target: [studySessionsTable.userId, studySessionsTable.id],
        set: row,
      });
    return session;
  }

  async saveSessionsBatch(userId: string, sessions: StudySession[]): Promise<void> {
    for (const s of sessions) {
      await this.saveSession(userId, s);
    }
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    const deleted = await db
      .delete(studySessionsTable)
      .where(
        and(
          eq(studySessionsTable.userId, userId),
          eq(studySessionsTable.id, sessionId)
        )
      )
      .returning({ id: studySessionsTable.id });
    return deleted.length > 0;
  }

  async listCompletionEvents(
    userId: string,
    options?: EventQueryOptions
  ): Promise<CompletionEvent[]> {
    const conditions = [eq(completionEventsTable.userId, userId)];
    if (options?.topicId) {
      conditions.push(eq(completionEventsTable.topicId, options.topicId));
    }

    const base = db
      .select()
      .from(completionEventsTable)
      .where(and(...conditions))
      .orderBy(desc(completionEventsTable.occurredAt));

    const rows = options?.limit ? await base.limit(options.limit) : await base;
    return rows.map(mapEventRow);
  }

  async recordCompletionEvent(
    userId: string,
    event: CompletionEvent
  ): Promise<CompletionEvent> {
    const row = {
      userId,
      id: event.id,
      topicId: event.topicId,
      eventType: event.eventType,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      occurredAt: event.occurredAt,
      source: event.source,
    };
    await db
      .insert(completionEventsTable)
      .values(row)
      .onConflictDoUpdate({
        target: [completionEventsTable.userId, completionEventsTable.id],
        set: row,
      });
    return event;
  }

  async recordCompletionEventsBatch(
    userId: string,
    events: CompletionEvent[]
  ): Promise<void> {
    for (const ev of events) {
      await this.recordCompletionEvent(userId, ev);
    }
  }

  async listGoals(userId: string): Promise<Goal[]> {
    const rows = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId));
    return rows.map((r) => ({
      id: r.id,
      periodType: r.periodType as GoalPeriodType,
      periodKey: r.periodKey,
      targetMinutes: r.targetMinutes,
      targetCompletedTopics: r.targetCompletedTopics,
      targetCompletedLabs: r.targetCompletedLabs,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getGoal(
    userId: string,
    periodType: GoalPeriodType,
    periodKey: string
  ): Promise<Goal | null> {
    const id = `${periodType}_${periodKey}`;
    const rows = await db
      .select()
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), eq(goalsTable.id, id)))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      periodType: r.periodType as GoalPeriodType,
      periodKey: r.periodKey,
      targetMinutes: r.targetMinutes,
      targetCompletedTopics: r.targetCompletedTopics,
      targetCompletedLabs: r.targetCompletedLabs,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async upsertGoal(userId: string, goal: Goal): Promise<Goal> {
    const id = `${goal.periodType}_${goal.periodKey}`;
    const row = {
      userId,
      id,
      periodType: goal.periodType,
      periodKey: goal.periodKey,
      targetMinutes: goal.targetMinutes,
      targetCompletedTopics: goal.targetCompletedTopics,
      targetCompletedLabs: goal.targetCompletedLabs,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
    await db
      .insert(goalsTable)
      .values(row)
      .onConflictDoUpdate({
        target: [goalsTable.userId, goalsTable.id],
        set: row,
      });
    return { ...goal, id };
  }

  async listReflections(userId: string): Promise<Reflection[]> {
    const rows = await db
      .select()
      .from(reflectionsTable)
      .where(eq(reflectionsTable.userId, userId))
      .orderBy(desc(reflectionsTable.periodKey));
    return rows.map((r) => ({
      id: r.id,
      periodType: r.periodType as ReflectionPeriodType,
      periodKey: r.periodKey,
      learned: r.learned,
      achievements: r.achievements,
      challenges: r.challenges,
      revisionItems: r.revisionItems,
      nextPriorities: r.nextPriorities,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getReflection(
    userId: string,
    periodType: ReflectionPeriodType,
    periodKey: string
  ): Promise<Reflection | null> {
    const id = `${periodType}_${periodKey}`;
    const rows = await db
      .select()
      .from(reflectionsTable)
      .where(and(eq(reflectionsTable.userId, userId), eq(reflectionsTable.id, id)))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      periodType: r.periodType as ReflectionPeriodType,
      periodKey: r.periodKey,
      learned: r.learned,
      achievements: r.achievements,
      challenges: r.challenges,
      revisionItems: r.revisionItems,
      nextPriorities: r.nextPriorities,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async upsertReflection(userId: string, reflection: Reflection): Promise<Reflection> {
    const id = `${reflection.periodType}_${reflection.periodKey}`;
    const row = {
      userId,
      id,
      periodType: reflection.periodType,
      periodKey: reflection.periodKey,
      learned: reflection.learned,
      achievements: reflection.achievements,
      challenges: reflection.challenges,
      revisionItems: reflection.revisionItems,
      nextPriorities: reflection.nextPriorities,
      createdAt: reflection.createdAt,
      updatedAt: reflection.updatedAt,
    };
    await db
      .insert(reflectionsTable)
      .values(row)
      .onConflictDoUpdate({
        target: [reflectionsTable.userId, reflectionsTable.id],
        set: row,
      });
    return { ...reflection, id };
  }
}
