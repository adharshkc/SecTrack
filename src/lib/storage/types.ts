import type {
  CompletionEvent,
  Goal,
  GoalPeriodType,
  Reflection,
  ReflectionPeriodType,
  StudySession,
  Topic,
  UserSettings,
} from "@/lib/types";

export interface StoredOwnerVault {
  ownerUid: string;
  ownerEmail: string | null;
  passwordHash: string | null;
  sessionSecret: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAuthSession {
  id: string;
  userId: string;
  csrfToken: string;
  authMethod: "master_password" | "vault_password";
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface RateLimitState {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface SessionQueryOptions {
  startDateKey?: string;
  endDateKey?: string;
  topicId?: string;
  limit?: number;
}

export interface EventQueryOptions {
  topicId?: string;
  limit?: number;
}

export interface LearningRepository {
  readonly providerName: "firestore" | "postgres";

  // Owner Vault & Auth Sessions & Rate Limits
  getOwnerVault(): Promise<StoredOwnerVault | null>;
  saveOwnerVault(vault: StoredOwnerVault): Promise<StoredOwnerVault>;
  createAuthSession(session: StoredAuthSession): Promise<void>;
  getAuthSession(sessionId: string): Promise<StoredAuthSession | null>;
  revokeAuthSession(sessionId: string): Promise<void>;
  checkAndIncrementRateLimit(
    key: string,
    maxAttempts: number,
    windowMs: number
  ): Promise<RateLimitState>;
  resetRateLimit(key: string): Promise<void>;

  // User Settings
  getSettings(userId: string): Promise<UserSettings>;
  updateSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings>;

  // Topics
  listTopics(userId: string): Promise<Topic[]>;
  getTopic(userId: string, topicId: string): Promise<Topic | null>;
  upsertTopicsBatch(userId: string, topics: Topic[]): Promise<void>;
  saveTopic(userId: string, topic: Topic): Promise<Topic>;
  deleteTopic(
    userId: string,
    topicId: string,
    deleteAssociatedRecords?: boolean
  ): Promise<{ deletedSubtopics: number; deletedSessions: number; deletedEvents: number }>;
  countTopicAssociatedRecords(
    userId: string,
    topicId: string
  ): Promise<{ subtopics: number; sessions: number; events: number }>;

  // Study Sessions
  listSessions(userId: string, options?: SessionQueryOptions): Promise<StudySession[]>;
  getSession(userId: string, sessionId: string): Promise<StudySession | null>;
  saveSession(userId: string, session: StudySession): Promise<StudySession>;
  saveSessionsBatch(userId: string, sessions: StudySession[]): Promise<void>;
  deleteSession(userId: string, sessionId: string): Promise<boolean>;

  // Completion Events
  listCompletionEvents(
    userId: string,
    options?: EventQueryOptions
  ): Promise<CompletionEvent[]>;
  recordCompletionEvent(userId: string, event: CompletionEvent): Promise<CompletionEvent>;
  recordCompletionEventsBatch(userId: string, events: CompletionEvent[]): Promise<void>;

  // Goals
  listGoals(userId: string): Promise<Goal[]>;
  getGoal(
    userId: string,
    periodType: GoalPeriodType,
    periodKey: string
  ): Promise<Goal | null>;
  upsertGoal(userId: string, goal: Goal): Promise<Goal>;

  // Reflections
  listReflections(userId: string): Promise<Reflection[]>;
  getReflection(
    userId: string,
    periodType: ReflectionPeriodType,
    periodKey: string
  ): Promise<Reflection | null>;
  upsertReflection(userId: string, reflection: Reflection): Promise<Reflection>;
}
