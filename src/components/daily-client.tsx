"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Save,
  Target,
  Trash2,
} from "lucide-react";
import type { DailySummary } from "@/lib/analytics";
import {
  addDaysToDateKey,
  formatDisplayDate,
  formatMinutesHuman,
} from "@/lib/dates";
import type { Reflection, StudySession, Topic } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { StudySessionModal } from "./session-modal";
import { Button, Card, ProgressBar } from "./ui/primitives";

export function DailyClient({
  csrfToken,
  dateKey,
  todayKey,
  timezone,
  summary,
  sessions,
  topics,
  initialReflection,
}: {
  csrfToken: string;
  dateKey: string;
  todayKey: string;
  timezone: string;
  summary: DailySummary;
  sessions: Array<StudySession & { topicTitle: string }>;
  topics: Topic[];
  initialReflection: Reflection | null;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);

  const [goalInput, setGoalInput] = useState(String(summary.targetMinutes));
  const [savingGoal, setSavingGoal] = useState(false);

  const [learned, setLearned] = useState(initialReflection?.learned || "");
  const [reflectionNotes, setReflectionNotes] = useState(
    initialReflection?.achievements || ""
  );
  const [challenges, setChallenges] = useState(
    initialReflection?.challenges || ""
  );
  const [nextPriorities, setNextPriorities] = useState(
    initialReflection?.nextPriorities || ""
  );
  const [savingReflection, setSavingReflection] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const navigateDate = (nextKey: string) => {
    router.push(`/daily?date=${nextKey}`);
  };

  const handleSaveDailyGoal = async (mins: number) => {
    if (savingGoal || mins < 5 || mins > 1440) return;
    setSavingGoal(true);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          periodType: "daily",
          periodKey: dateKey,
          targetMinutes: mins,
        }),
      });
      setGoalInput(String(mins));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update daily goal.");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        csrfToken,
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete session.");
    }
  };

  const handleSaveReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingReflection) return;
    setSavingReflection(true);
    setSavedToast(null);
    try {
      await apiFetch("/api/reflections", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          periodType: "daily",
          periodKey: dateKey,
          learned,
          achievements: reflectionNotes,
          challenges,
          revisionItems: "",
          nextPriorities,
        }),
      });
      setSavedToast("Daily learning notes & reflection saved.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save reflection.");
    } finally {
      setSavingReflection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Navigator */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Daily Learning Tracker · {timezone}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatDisplayDate(dateKey)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate(addDaysToDateKey(dateKey, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <input
            type="date"
            aria-label="Select date"
            value={dateKey}
            onChange={(e) => e.target.value && navigateDate(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          {dateKey !== todayKey ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigateDate(todayKey)}
            >
              Today
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate(addDaysToDateKey(dateKey, 1))}
            aria-label="Next day"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingSession(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Log Session
          </Button>
        </div>
      </div>

      {/* 4 Daily Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total Study Time
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {formatMinutesHuman(summary.totalMinutes)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Across {summary.sessionCount} valid session(s)
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Topics Studied
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {summary.topicsStudiedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Distinct roadmap topics touched
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Topics Completed
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">
            {summary.topicsCompletedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Completed on {dateKey}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily Goal Progress
            </p>
            <span className="font-mono text-xs font-semibold text-emerald-500">
              {summary.goalPercentage}%
            </span>
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
            {formatMinutesHuman(summary.totalMinutes)} /{" "}
            {formatMinutesHuman(summary.targetMinutes)}
          </p>
          <ProgressBar value={summary.goalPercentage} className="mt-2" />
        </Card>
      </div>

      {/* Daily Goal Configurator */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Configure Daily Study Goal:
            </span>
            <div className="flex items-center gap-1.5">
              {[60, 90, 120, 180].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSaveDailyGoal(preset)}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs cursor-pointer ${
                    summary.targetMinutes === preset
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDailyGoal(Number(goalInput));
            }}
            className="flex items-center gap-2"
          >
            <input
              type="number"
              min={5}
              max={1440}
              aria-label="Custom daily target in minutes"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={savingGoal}>
              Set Minutes
            </Button>
          </form>
        </div>
      </Card>

      {/* Daily Activity Timeline & Daily Reflection */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Daily Activity Timeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Edit or remove sessions anytime — totals recalculate without double
                counting
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingSession(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
              <Clock className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                No study sessions logged for {dateKey}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Log theory, reading, hands-on labs, CTF challenges, or revision.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {s.activityType}
                        </span>
                        {s.startedAt ? (
                          <span className="font-mono text-xs text-slate-500">
                            {s.startedAt}
                          </span>
                        ) : null}
                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {formatMinutesHuman(s.durationMinutes)}
                        </span>
                        <span className="text-xs text-slate-500">
                          Confidence: {s.confidence}/5
                        </span>
                      </div>

                      <Link
                        href={`/roadmap/${s.topicId}`}
                        className="mt-1.5 block text-sm font-semibold text-slate-900 hover:text-emerald-500 dark:text-slate-100"
                      >
                        {s.topicTitle}
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSession(s);
                          setModalOpen(true);
                        }}
                        aria-label="Edit study session"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:hover:text-white cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        aria-label="Delete study session"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-rose-500 dark:border-slate-800 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {s.outcome ? (
                    <p className="mt-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      Outcome: {s.outcome}
                    </p>
                  ) : null}
                  {s.notes ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {s.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Daily Learning Notes & Daily Reflection */}
        <Card className="p-5">
          <form onSubmit={handleSaveReflection} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Daily Learning Notes &amp; Reflection
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Journal for {dateKey}
                </p>
              </div>
              <Button type="submit" size="sm" disabled={savingReflection}>
                <Save className="h-3.5 w-3.5" />
                <span>{savingReflection ? "Saving..." : "Save Journal"}</span>
              </Button>
            </div>

            {savedToast ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
                {savedToast}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="daily-learned"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Learning Notes &amp; Key Concepts
              </label>
              <textarea
                id="daily-learned"
                rows={4}
                placeholder="Core security concepts, protocols, vulnerabilities, or commands studied today..."
                value={learned}
                onChange={(e) => setLearned(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="daily-reflection"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Daily Reflection &amp; Wins
              </label>
              <textarea
                id="daily-reflection"
                rows={3}
                placeholder="What clicked today? Which practical labs or exercises went well?"
                value={reflectionNotes}
                onChange={(e) => setReflectionNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="daily-blockers"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Friction / Blockers Encountered
              </label>
              <textarea
                id="daily-blockers"
                rows={2}
                placeholder="Any confusing areas or lab issues to revisit?"
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="daily-tomorrow"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Tomorrow&apos;s Focus
              </label>
              <input
                id="daily-tomorrow"
                type="text"
                placeholder="Next immediate study target..."
                value={nextPriorities}
                onChange={(e) => setNextPriorities(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </form>
        </Card>
      </div>

      <StudySessionModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSession(null);
        }}
        csrfToken={csrfToken}
        topics={topics}
        defaultDateKey={dateKey}
        editingSession={editingSession}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
