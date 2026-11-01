import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { DEFAULT_TIMEZONE } from "@/lib/types";
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
import type {
  EventQueryOptions,
  LearningRepository,
  RateLimitState,
  SessionQueryOptions,
  StoredAuthSession,
  StoredOwnerVault,
} from "./types";

/**
 * Removes Firestore-only bookkeeping fields (e.g. `_serverUpdatedAt`), which
 * hold Timestamp class instances that cannot be passed to Client Components.
 */
function fromDoc<T>(data: FirebaseFirestore.DocumentData | undefined): T {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (!key.startsWith("_server")) clean[key] = value;
  }
  return clean as T;
}

function defaultSettings(): UserSettings {
  return {
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
    updatedAt: new Date().toISOString(),
  };
}

export class FirestoreRepository implements LearningRepository {
  readonly providerName = "firestore" as const;

  private get db() {
    return getAdminFirestore();
  }

  private userDoc(userId: string) {
    return this.db.collection("users").doc(userId);
  }

  async getOwnerVault(): Promise<StoredOwnerVault | null> {
    const snap = await this.db.collection("_system").doc("ownerVault").get();
    if (!snap.exists) return null;
    return fromDoc<StoredOwnerVault>(snap.data());
  }

  async saveOwnerVault(vault: StoredOwnerVault): Promise<StoredOwnerVault> {
    await this.db
      .collection("_system")
      .doc("ownerVault")
      .set({ ...vault, _serverUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return vault;
  }

  async createAuthSession(session: StoredAuthSession): Promise<void> {
    await this.db
      .collection("_authSessions")
      .doc(session.id)
      .set({ ...session, _serverCreatedAt: FieldValue.serverTimestamp() });
  }

  async getAuthSession(sessionId: string): Promise<StoredAuthSession | null> {
    const snap = await this.db.collection("_authSessions").doc(sessionId).get();
    if (!snap.exists) return null;
    const data = fromDoc<StoredAuthSession>(snap.data());
    return data;
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    await this.db
      .collection("_authSessions")
      .doc(sessionId)
      .set({ revokedAt: new Date().toISOString() }, { merge: true });
  }

  async checkAndIncrementRateLimit(
    key: string,
    maxAttempts: number,
    windowMs: number
  ): Promise<RateLimitState> {
    const ref = this.db.collection("_rateLimits").doc(key);
    const now = Date.now();

    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, {
          attempts: 1,
          windowStartedAtMs: now,
          blockedUntilMs: null,
        });
        return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
      }

      const data = fromDoc<{
        attempts: number;
        windowStartedAtMs: number;
        blockedUntilMs: number | null;
      }>(snap.data());

      if (data.blockedUntilMs && data.blockedUntilMs > now) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((data.blockedUntilMs - now) / 1000),
        };
      }

      if (now - data.windowStartedAtMs > windowMs) {
        tx.set(ref, {
          attempts: 1,
          windowStartedAtMs: now,
          blockedUntilMs: null,
        });
        return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
      }

      const nextAttempts = (data.attempts || 0) + 1;
      if (nextAttempts > maxAttempts) {
        const blockedUntilMs = now + windowMs;
        tx.update(ref, { attempts: nextAttempts, blockedUntilMs });
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        };
      }

      tx.update(ref, { attempts: nextAttempts });
      return {
        allowed: true,
        remaining: Math.max(0, maxAttempts - nextAttempts),
        retryAfterSeconds: 0,
      };
    });
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.db.collection("_rateLimits").doc(key).delete();
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const ref = this.userDoc(userId).collection("settings").doc("preferences");
    const snap = await ref.get();
    if (!snap.exists) {
      const initial = defaultSettings();
      await ref.set({ ...initial, _serverUpdatedAt: FieldValue.serverTimestamp() });
      return initial;
    }
    return { ...defaultSettings(), ...(fromDoc<Partial<UserSettings>>(snap.data())) };
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
    await this.userDoc(userId)
      .collection("settings")
      .doc("preferences")
      .set({ ...updated, _serverUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return updated;
  }

  async listTopics(userId: string): Promise<Topic[]> {
    const snap = await this.userDoc(userId)
      .collection("topics")
      .orderBy("order", "asc")
      .get();
    return snap.docs.map((d) => fromDoc<Topic>(d.data()));
  }

  async getTopic(userId: string, topicId: string): Promise<Topic | null> {
    const snap = await this.userDoc(userId).collection("topics").doc(topicId).get();
    if (!snap.exists) return null;
    return fromDoc<Topic>(snap.data());
  }

  async upsertTopicsBatch(userId: string, topics: Topic[]): Promise<void> {
    const col = this.userDoc(userId).collection("topics");
    // Firestore batch limit is 500 writes
    for (let i = 0; i < topics.length; i += 400) {
      const slice = topics.slice(i, i + 400);
      const batch = this.db.batch();
      for (const topic of slice) {
        batch.set(
          col.doc(topic.id),
          { ...topic, _serverUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      await batch.commit();
    }
  }

  async saveTopic(userId: string, topic: Topic): Promise<Topic> {
    await this.userDoc(userId)
      .collection("topics")
      .doc(topic.id)
      .set({ ...topic, _serverUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return topic;
  }

  async countTopicAssociatedRecords(userId: string, topicId: string) {
    const [subsSnap, sessSnap, evSnap] = await Promise.all([
      this.userDoc(userId)
        .collection("topics")
        .where("parentTopicId", "==", topicId)
        .get(),
      this.userDoc(userId)
        .collection("studySessions")
        .where("topicId", "==", topicId)
        .get(),
      this.userDoc(userId)
        .collection("completionEvents")
        .where("topicId", "==", topicId)
        .get(),
    ]);
    return {
      subtopics: subsSnap.size,
      sessions: sessSnap.size,
      events: evSnap.size,
    };
  }

  async deleteTopic(
    userId: string,
    topicId: string,
    deleteAssociatedRecords: boolean = false
  ) {
    const subsSnap = await this.userDoc(userId)
      .collection("topics")
      .where("parentTopicId", "==", topicId)
      .get();
    const targetTopicIds = [topicId, ...subsSnap.docs.map((d) => d.id)];

    let deletedSessions = 0;
    let deletedEvents = 0;

    const batch = this.db.batch();
    for (const tid of targetTopicIds) {
      batch.delete(this.userDoc(userId).collection("topics").doc(tid));
    }

    if (deleteAssociatedRecords) {
      for (const tid of targetTopicIds) {
        const sessSnap = await this.userDoc(userId)
          .collection("studySessions")
          .where("topicId", "==", tid)
          .get();
        for (const doc of sessSnap.docs) {
          batch.delete(doc.ref);
          deletedSessions++;
        }
        const evSnap = await this.userDoc(userId)
          .collection("completionEvents")
          .where("topicId", "==", tid)
          .get();
        for (const doc of evSnap.docs) {
          batch.delete(doc.ref);
          deletedEvents++;
        }
      }
    }

    await batch.commit();
    return {
      deletedSubtopics: subsSnap.size,
      deletedSessions,
      deletedEvents,
    };
  }

  async listSessions(
    userId: string,
    options?: SessionQueryOptions
  ): Promise<StudySession[]> {
    let query: FirebaseFirestore.Query = this.userDoc(userId).collection("studySessions");

    if (options?.topicId) {
      query = query.where("topicId", "==", options.topicId);
    }
    if (options?.startDateKey) {
      query = query.where("dateKey", ">=", options.startDateKey);
    }
    if (options?.endDateKey) {
      query = query.where("dateKey", "<=", options.endDateKey);
    }

    query = query.orderBy("dateKey", "desc");
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snap = await query.get();
    return snap.docs.map((d) => fromDoc<StudySession>(d.data()));
  }

  async getSession(userId: string, sessionId: string): Promise<StudySession | null> {
    const snap = await this.userDoc(userId)
      .collection("studySessions")
      .doc(sessionId)
      .get();
    if (!snap.exists) return null;
    return fromDoc<StudySession>(snap.data());
  }

  async saveSession(userId: string, session: StudySession): Promise<StudySession> {
    await this.userDoc(userId)
      .collection("studySessions")
      .doc(session.id)
      .set(
        { ...session, _serverUpdatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    return session;
  }

  async saveSessionsBatch(userId: string, sessions: StudySession[]): Promise<void> {
    const col = this.userDoc(userId).collection("studySessions");
    for (let i = 0; i < sessions.length; i += 400) {
      const batch = this.db.batch();
      for (const s of sessions.slice(i, i + 400)) {
        batch.set(
          col.doc(s.id),
          { ...s, _serverUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      await batch.commit();
    }
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    const ref = this.userDoc(userId).collection("studySessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  }

  async listCompletionEvents(
    userId: string,
    options?: EventQueryOptions
  ): Promise<CompletionEvent[]> {
    let query: FirebaseFirestore.Query =
      this.userDoc(userId).collection("completionEvents");
    if (options?.topicId) {
      query = query.where("topicId", "==", options.topicId);
    }
    query = query.orderBy("occurredAt", "desc");
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    const snap = await query.get();
    return snap.docs.map((d) => fromDoc<CompletionEvent>(d.data()));
  }

  async recordCompletionEvent(
    userId: string,
    event: CompletionEvent
  ): Promise<CompletionEvent> {
    await this.userDoc(userId)
      .collection("completionEvents")
      .doc(event.id)
      .set({ ...event, _serverOccurredAt: FieldValue.serverTimestamp() });
    return event;
  }

  async recordCompletionEventsBatch(
    userId: string,
    events: CompletionEvent[]
  ): Promise<void> {
    const col = this.userDoc(userId).collection("completionEvents");
    for (let i = 0; i < events.length; i += 400) {
      const batch = this.db.batch();
      for (const ev of events.slice(i, i + 400)) {
        batch.set(
          col.doc(ev.id),
          { ...ev, _serverOccurredAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      await batch.commit();
    }
  }

  async listGoals(userId: string): Promise<Goal[]> {
    const snap = await this.userDoc(userId).collection("goals").get();
    return snap.docs.map((d) => fromDoc<Goal>(d.data()));
  }

  async getGoal(
    userId: string,
    periodType: GoalPeriodType,
    periodKey: string
  ): Promise<Goal | null> {
    const id = `${periodType}_${periodKey}`;
    const snap = await this.userDoc(userId).collection("goals").doc(id).get();
    if (!snap.exists) return null;
    return fromDoc<Goal>(snap.data());
  }

  async upsertGoal(userId: string, goal: Goal): Promise<Goal> {
    const id = `${goal.periodType}_${goal.periodKey}`;
    const normalized = { ...goal, id };
    await this.userDoc(userId)
      .collection("goals")
      .doc(id)
      .set(
        { ...normalized, _serverUpdatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    return normalized;
  }

  async listReflections(userId: string): Promise<Reflection[]> {
    const snap = await this.userDoc(userId)
      .collection("reflections")
      .orderBy("periodKey", "desc")
      .get();
    return snap.docs.map((d) => fromDoc<Reflection>(d.data()));
  }

  async getReflection(
    userId: string,
    periodType: ReflectionPeriodType,
    periodKey: string
  ): Promise<Reflection | null> {
    const id = `${periodType}_${periodKey}`;
    const snap = await this.userDoc(userId).collection("reflections").doc(id).get();
    if (!snap.exists) return null;
    return fromDoc<Reflection>(snap.data());
  }

  async upsertReflection(userId: string, reflection: Reflection): Promise<Reflection> {
    const id = `${reflection.periodType}_${reflection.periodKey}`;
    const normalized = { ...reflection, id };
    await this.userDoc(userId)
      .collection("reflections")
      .doc(id)
      .set(
        { ...normalized, _serverUpdatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    return normalized;
  }
}
