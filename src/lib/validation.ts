import { z } from "zod";
import {
  ACTIVITY_TYPES,
  COMPLETION_EVENT_TYPES,
  GOAL_PERIOD_TYPES,
  REFLECTION_PERIOD_TYPES,
  RESOURCE_TYPES,
  TOPIC_DIFFICULTIES,
  TOPIC_PRIORITIES,
  TOPIC_STATUSES,
} from "./types";
import { isValidDateKey, isValidMonthKey, isValidTimezone } from "./dates";

export const dateKeySchema = z
  .string()
  .trim()
  .refine(isValidDateKey, { message: "Invalid calendar date (expected YYYY-MM-DD)" });

export const monthKeySchema = z
  .string()
  .trim()
  .refine(isValidMonthKey, { message: "Invalid month key (expected YYYY-MM)" });

export const resourceLinkSchema = z.object({
  title: z.string().trim().min(1, "Resource title required").max(200),
  url: z
    .string()
    .trim()
    .url("Valid URL required")
    .refine(
      (u) => u.startsWith("https://") || u.startsWith("http://"),
      "Only http/https URLs are permitted"
    ),
  type: z.enum(RESOURCE_TYPES),
  note: z.string().trim().max(400).optional(),
});

export const createTopicSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(180),
  description: z.string().trim().max(4000).default(""),
  phaseId: z.string().trim().min(1).max(100),
  sectionId: z.string().trim().min(1).max(100),
  parentTopicId: z.string().trim().max(120).nullable().optional().default(null),
  order: z.number().int().min(0).max(100_000).optional(),
  status: z.enum(TOPIC_STATUSES).optional().default("Not Started"),
  priority: z.enum(TOPIC_PRIORITIES).default("Recommended"),
  difficulty: z.enum(TOPIC_DIFFICULTIES).default("Intermediate"),
  estimatedDuration: z.string().trim().max(80).default("1 week"),
  estimatedMinutes: z.number().int().min(5).max(100_000).default(120),
  prerequisites: z.array(z.string().trim().max(120)).max(30).optional().default([]),
  resourceLinks: z.array(resourceLinkSchema).max(40).optional().default([]),
  practicalExercises: z.array(z.string().trim().min(1).max(400)).max(40).optional().default([]),
  learningObjectives: z.array(z.string().trim().min(1).max(400)).max(40).optional().default([]),
  tools: z.array(z.string().trim().min(1).max(100)).max(30).optional().default([]),
  notes: z.string().max(50_000).optional().default(""),
  commandsLearned: z.string().max(25_000).optional().default(""),
  questionsToRevisit: z.string().max(25_000).optional().default(""),
  confidence: z.number().int().min(0).max(5).optional().default(0),
  nextAction: z.string().trim().max(500).optional().default(""),
  plannedDate: dateKeySchema.nullable().optional().default(null),
});

export const updateTopicSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(4000).optional(),
  phaseId: z.string().trim().min(1).max(100).optional(),
  sectionId: z.string().trim().min(1).max(100).optional(),
  parentTopicId: z.string().trim().max(120).nullable().optional(),
  order: z.number().int().min(0).max(100_000).optional(),
  status: z.enum(TOPIC_STATUSES).optional(),
  reopenForRevision: z.boolean().optional(),
  priority: z.enum(TOPIC_PRIORITIES).optional(),
  difficulty: z.enum(TOPIC_DIFFICULTIES).optional(),
  estimatedDuration: z.string().trim().max(80).optional(),
  estimatedMinutes: z.number().int().min(5).max(100_000).optional(),
  prerequisites: z.array(z.string().trim().max(120)).max(30).optional(),
  resourceLinks: z.array(resourceLinkSchema).max(40).optional(),
  practicalExercises: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
  completedExercises: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
  learningObjectives: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
  completedObjectives: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
  tools: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  notes: z.string().max(50_000).optional(),
  commandsLearned: z.string().max(25_000).optional(),
  questionsToRevisit: z.string().max(25_000).optional(),
  confidence: z.number().int().min(0).max(5).optional(),
  nextAction: z.string().trim().max(500).optional(),
  plannedDate: dateKeySchema.nullable().optional(),
});

export const createStudySessionSchema = z.object({
  topicId: z.string().trim().min(1, "Topic is required").max(120),
  dateKey: dateKeySchema,
  startedAt: z
    .string()
    .trim()
    .max(40)
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM (24-hour)")
    .nullable()
    .optional()
    .default(null),
  durationMinutes: z
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(1440, "Single session cannot exceed 1440 minutes (24 hours)"),
  activityType: z.enum(ACTIVITY_TYPES),
  notes: z.string().trim().max(10_000).optional().default(""),
  outcome: z.string().trim().max(1000).optional().default(""),
  confidence: z.number().int().min(1).max(5).default(3),
  clientRequestId: z.string().trim().max(100).optional(),
});

export const updateStudySessionSchema = createStudySessionSchema.partial().refine(
  (val) => Object.keys(val).length > 0,
  "At least one field must be updated"
);

export const upsertGoalSchema = z.object({
  periodType: z.enum(GOAL_PERIOD_TYPES),
  periodKey: z.string().trim().min(1).max(32),
  targetMinutes: z.number().int().min(0).max(100_000),
  targetCompletedTopics: z.number().int().min(0).max(1000).optional().default(0),
  targetCompletedLabs: z.number().int().min(0).max(1000).optional().default(0),
});

export const upsertReflectionSchema = z.object({
  periodType: z.enum(REFLECTION_PERIOD_TYPES),
  periodKey: z.string().trim().min(4).max(32),
  learned: z.string().max(15_000).default(""),
  achievements: z.string().max(15_000).default(""),
  challenges: z.string().max(15_000).default(""),
  revisionItems: z.string().max(15_000).default(""),
  nextPriorities: z.string().max(15_000).default(""),
});

export const updateSettingsSchema = z.object({
  timezone: z
    .string()
    .trim()
    .refine(isValidTimezone, "Invalid IANA timezone")
    .optional(),
  dailyTargetMinutes: z.number().int().min(5).max(1440).optional(),
  weeklyTargetMinutes: z.number().int().min(15).max(10080).optional(),
  monthlyTargetMinutes: z.number().int().min(30).max(44640).optional(),
  monthlyTargetTopics: z.number().int().min(0).max(500).optional(),
  monthlyTargetLabs: z.number().int().min(0).max(500).optional(),
  theme: z.enum(["dark", "light"]).optional(),
});

export const masterLoginSchema = z.object({
  password: z.string().min(1, "Password is required").max(256),
});

export const backupImportSchema = z.object({
  mode: z.enum(["merge", "skip_existing"]).default("skip_existing"),
  payload: z.object({
    schemaVersion: z.literal("1.0.0"),
    exportedAt: z.string(),
    sourceApplication: z.string().optional(),
    settings: z
      .object({
        timezone: z.string().refine(isValidTimezone).optional(),
        dailyTargetMinutes: z.number().int().min(5).max(1440).optional(),
        weeklyTargetMinutes: z.number().int().min(15).max(10080).optional(),
        monthlyTargetMinutes: z.number().int().min(30).max(44640).optional(),
        monthlyTargetTopics: z.number().int().min(0).max(500).optional(),
        monthlyTargetLabs: z.number().int().min(0).max(500).optional(),
      })
      .optional(),
    topics: z.array(
      z.object({
        id: z.string().min(1).max(120),
        title: z.string().min(1).max(180),
        description: z.string().max(4000).default(""),
        phaseId: z.string().min(1).max(100),
        sectionId: z.string().min(1).max(100),
        parentTopicId: z.string().max(120).nullable().default(null),
        order: z.number().int().min(0).default(0),
        status: z.enum(TOPIC_STATUSES),
        priority: z.enum(TOPIC_PRIORITIES),
        difficulty: z.enum(TOPIC_DIFFICULTIES),
        estimatedDuration: z.string().max(80).default("1 week"),
        estimatedMinutes: z.number().int().min(1).max(100_000).default(60),
        prerequisites: z.array(z.string()).default([]),
        resourceLinks: z.array(resourceLinkSchema).default([]),
        practicalExercises: z.array(z.string()).default([]),
        completedExercises: z.array(z.string()).default([]),
        learningObjectives: z.array(z.string()).default([]),
        completedObjectives: z.array(z.string()).default([]),
        tools: z.array(z.string()).default([]),
        notes: z.string().max(50_000).default(""),
        commandsLearned: z.string().max(25_000).default(""),
        questionsToRevisit: z.string().max(25_000).default(""),
        confidence: z.number().int().min(0).max(5).default(0),
        nextAction: z.string().max(500).default(""),
        plannedDate: dateKeySchema.nullable().default(null),
        isCustom: z.boolean().default(false),
        isTrackable: z.boolean().default(true),
        sourceUrl: z.string().default("https://www.itshahirx.com/roadmap"),
        lastReviewedAt: z.string().default("2026-03-01"),
        createdAt: z.string(),
        updatedAt: z.string(),
        completedAt: z.string().nullable().default(null),
      })
    ),
    studySessions: z.array(
      z.object({
        id: z.string().min(1).max(120),
        topicId: z.string().min(1).max(120),
        dateKey: dateKeySchema,
        startedAt: z.string().nullable().default(null),
        durationMinutes: z.number().int().min(1).max(1440),
        activityType: z.enum(ACTIVITY_TYPES),
        notes: z.string().max(10_000).default(""),
        outcome: z.string().max(1000).default(""),
        confidence: z.number().int().min(1).max(5).default(3),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    ),
    completionEvents: z.array(
      z.object({
        id: z.string().min(1).max(120),
        topicId: z.string().min(1).max(120),
        eventType: z.enum(COMPLETION_EVENT_TYPES),
        previousStatus: z.enum(TOPIC_STATUSES).nullable(),
        newStatus: z.enum(TOPIC_STATUSES),
        occurredAt: z.string(),
        source: z.enum(["manual", "reopen", "session", "import"]).default("import"),
      })
    ),
    goals: z.array(
      z.object({
        id: z.string().min(1).max(120),
        periodType: z.enum(GOAL_PERIOD_TYPES),
        periodKey: z.string().min(1).max(32),
        targetMinutes: z.number().int().min(0).max(100_000),
        targetCompletedTopics: z.number().int().min(0).default(0),
        targetCompletedLabs: z.number().int().min(0).default(0),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    ),
    reflections: z.array(
      z.object({
        id: z.string().min(1).max(120),
        periodType: z.enum(REFLECTION_PERIOD_TYPES),
        periodKey: z.string().min(1).max(32),
        learned: z.string().max(15_000).default(""),
        achievements: z.string().max(15_000).default(""),
        challenges: z.string().max(15_000).default(""),
        revisionItems: z.string().max(15_000).default(""),
        nextPriorities: z.string().max(15_000).default(""),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    ),
  }),
});
