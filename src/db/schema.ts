import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { ResourceLink } from "@/lib/types";

export const ownerVaultTable = pgTable("owner_vault", {
  id: text("id").primaryKey(), // "singleton"
  ownerUid: text("owner_uid").notNull(),
  ownerEmail: text("owner_email"),
  passwordHash: text("password_hash"),
  sessionSecret: text("session_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessionsTable = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    csrfToken: text("csrf_token").notNull(),
    authMethod: text("auth_method").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("auth_sessions_user_idx").on(table.userId)]
);

export const rateLimitsTable = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  dailyTargetMinutes: integer("daily_target_minutes").notNull().default(90),
  weeklyTargetMinutes: integer("weekly_target_minutes").notNull().default(540),
  monthlyTargetMinutes: integer("monthly_target_minutes").notNull().default(2400),
  monthlyTargetTopics: integer("monthly_target_topics").notNull().default(4),
  monthlyTargetLabs: integer("monthly_target_labs").notNull().default(8),
  roadmapSeededVersion: text("roadmap_seeded_version"),
  roadmapSourceUrl: text("roadmap_source_url")
    .notNull()
    .default("https://www.itshahirx.com/roadmap"),
  roadmapLastSyncedAt: text("roadmap_last_synced_at"),
  theme: text("theme").notNull().default("dark"),
  updatedAt: text("updated_at").notNull(),
});

export const topicsTable = pgTable(
  "topics",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    phaseId: text("phase_id").notNull(),
    sectionId: text("section_id").notNull(),
    parentTopicId: text("parent_topic_id"),
    order: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("Not Started"),
    priority: text("priority").notNull().default("Recommended"),
    difficulty: text("difficulty").notNull().default("Intermediate"),
    estimatedDuration: text("estimated_duration").notNull().default("1 week"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(120),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    resourceLinks: jsonb("resource_links").$type<ResourceLink[]>().notNull().default([]),
    practicalExercises: jsonb("practical_exercises")
      .$type<string[]>()
      .notNull()
      .default([]),
    completedExercises: jsonb("completed_exercises")
      .$type<string[]>()
      .notNull()
      .default([]),
    learningObjectives: jsonb("learning_objectives")
      .$type<string[]>()
      .notNull()
      .default([]),
    completedObjectives: jsonb("completed_objectives")
      .$type<string[]>()
      .notNull()
      .default([]),
    tools: jsonb("tools").$type<string[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    commandsLearned: text("commands_learned").notNull().default(""),
    questionsToRevisit: text("questions_to_revisit").notNull().default(""),
    confidence: integer("confidence").notNull().default(0),
    nextAction: text("next_action").notNull().default(""),
    plannedDate: text("planned_date"),
    isCustom: boolean("is_custom").notNull().default(false),
    isTrackable: boolean("is_trackable").notNull().default(true),
    sourceUrl: text("source_url")
      .notNull()
      .default("https://www.itshahirx.com/roadmap"),
    lastReviewedAt: text("last_reviewed_at").notNull().default("2026-03-01"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("topics_user_phase_idx").on(table.userId, table.phaseId),
    index("topics_user_status_idx").on(table.userId, table.status),
    index("topics_user_order_idx").on(table.userId, table.order),
  ]
);

export const studySessionsTable = pgTable(
  "study_sessions",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    topicId: text("topic_id").notNull(),
    dateKey: text("date_key").notNull(),
    startedAt: text("started_at"),
    durationMinutes: integer("duration_minutes").notNull(),
    activityType: text("activity_type").notNull(),
    notes: text("notes").notNull().default(""),
    outcome: text("outcome").notNull().default(""),
    confidence: integer("confidence").notNull().default(3),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("sessions_user_date_idx").on(table.userId, table.dateKey),
    index("sessions_user_topic_idx").on(table.userId, table.topicId),
  ]
);

export const completionEventsTable = pgTable(
  "completion_events",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    topicId: text("topic_id").notNull(),
    eventType: text("event_type").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    occurredAt: text("occurred_at").notNull(),
    source: text("source").notNull().default("manual"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("events_user_occurred_idx").on(table.userId, table.occurredAt),
    index("events_user_topic_idx").on(table.userId, table.topicId),
  ]
);

export const goalsTable = pgTable(
  "goals",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    periodType: text("period_type").notNull(),
    periodKey: text("period_key").notNull(),
    targetMinutes: integer("target_minutes").notNull(),
    targetCompletedTopics: integer("target_completed_topics").notNull().default(0),
    targetCompletedLabs: integer("target_completed_labs").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("goals_user_period_idx").on(table.userId, table.periodType, table.periodKey),
  ]
);

export const reflectionsTable = pgTable(
  "reflections",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    periodType: text("period_type").notNull(),
    periodKey: text("period_key").notNull(),
    learned: text("learned").notNull().default(""),
    achievements: text("achievements").notNull().default(""),
    challenges: text("challenges").notNull().default(""),
    revisionItems: text("revision_items").notNull().default(""),
    nextPriorities: text("next_priorities").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("reflections_user_period_idx").on(
      table.userId,
      table.periodType,
      table.periodKey
    ),
  ]
);
