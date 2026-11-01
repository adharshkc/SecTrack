export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const TOPIC_STATUSES = [
  "Not Started",
  "In Progress",
  "Practiced",
  "Completed",
  "Needs Revision",
] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const TOPIC_PRIORITIES = ["Essential", "Recommended", "Optional"] as const;
export type TopicPriority = (typeof TOPIC_PRIORITIES)[number];

export const TOPIC_DIFFICULTIES = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
export type TopicDifficulty = (typeof TOPIC_DIFFICULTIES)[number];

export const RESOURCE_TYPES = [
  "documentation",
  "tutorial",
  "video",
  "lab",
  "course",
  "book",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const ACTIVITY_TYPES = [
  "Theory",
  "Lab",
  "Reading",
  "Video",
  "CTF",
  "Revision",
  "Project",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const GOAL_PERIOD_TYPES = ["daily", "weekly", "monthly"] as const;
export type GoalPeriodType = (typeof GOAL_PERIOD_TYPES)[number];

export const REFLECTION_PERIOD_TYPES = ["daily", "weekly", "monthly"] as const;
export type ReflectionPeriodType = (typeof REFLECTION_PERIOD_TYPES)[number];

export const COMPLETION_EVENT_TYPES = [
  "completed",
  "reopened_for_revision",
  "status_changed",
  "reset",
] as const;
export type CompletionEventType = (typeof COMPLETION_EVENT_TYPES)[number];

export interface ResourceLink {
  title: string;
  url: string;
  type: ResourceType;
  note?: string;
}

export interface RoadmapPhase {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  estimatedDuration: string;
  description: string;
  order: number;
}

export interface RoadmapSection {
  id: string;
  phaseId: string;
  number: number;
  title: string;
  order: number;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  sectionId: string;
  parentTopicId: string | null;
  order: number;
  status: TopicStatus;
  priority: TopicPriority;
  difficulty: TopicDifficulty;
  estimatedDuration: string;
  estimatedMinutes: number;
  prerequisites: string[];
  resourceLinks: ResourceLink[];
  practicalExercises: string[];
  completedExercises: string[];
  learningObjectives: string[];
  completedObjectives: string[];
  tools: string[];
  notes: string;
  commandsLearned: string;
  questionsToRevisit: string;
  confidence: number; // 0 = unrated, 1..5
  nextAction: string;
  plannedDate: string | null; // YYYY-MM-DD
  isCustom: boolean;
  isTrackable: boolean;
  sourceUrl: string;
  lastReviewedAt: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  completedAt: string | null; // ISO
}

export interface StudySession {
  id: string;
  topicId: string;
  dateKey: string; // YYYY-MM-DD in user's configured timezone
  startedAt: string | null; // HH:mm or ISO optional
  durationMinutes: number;
  activityType: ActivityType;
  notes: string;
  outcome: string;
  confidence: number; // 1..5
  createdAt: string;
  updatedAt: string;
}

export interface CompletionEvent {
  id: string;
  topicId: string;
  eventType: CompletionEventType;
  previousStatus: TopicStatus | null;
  newStatus: TopicStatus;
  occurredAt: string; // ISO timestamp
  source: "manual" | "reopen" | "session" | "import";
}

export interface Goal {
  id: string;
  periodType: GoalPeriodType;
  periodKey: string; // "default" or YYYY-MM-DD or YYYY-Www or YYYY-MM
  targetMinutes: number;
  targetCompletedTopics: number;
  targetCompletedLabs: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reflection {
  id: string;
  periodType: ReflectionPeriodType;
  periodKey: string; // YYYY-MM-DD (daily), YYYY-MM-DD (monday of week), YYYY-MM (monthly)
  learned: string;
  achievements: string; // Also maps to "What I practiced" for weekly
  challenges: string; // "What I found difficult"
  revisionItems: string; // "What I need to revise"
  nextPriorities: string; // "My next week's / month's priorities"
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  id: string;
  timezone: string;
  dailyTargetMinutes: number;
  weeklyTargetMinutes: number;
  monthlyTargetMinutes: number;
  monthlyTargetTopics: number;
  monthlyTargetLabs: number;
  roadmapSeededVersion: string | null;
  roadmapSourceUrl: string;
  roadmapLastSyncedAt: string | null;
  theme: "dark" | "light";
  updatedAt: string;
}

export interface BackupPayload {
  schemaVersion: "1.0.0";
  exportedAt: string;
  sourceApplication: "Cybersecurity Learning Tracker";
  settings: UserSettings;
  topics: Topic[];
  studySessions: StudySession[];
  completionEvents: CompletionEvent[];
  goals: Goal[];
  reflections: Reflection[];
}
