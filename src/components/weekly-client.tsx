"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Save,
  Target,
} from "lucide-react";
import type {
  RoadmapCompletionSummary,
  WeeklyReportSummary,
} from "@/lib/analytics";
import {
  addDaysToDateKey,
  formatDisplayDate,
  formatMinutesHuman,
  formatShortDay,
} from "@/lib/dates";
import type { Reflection, Topic } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import {
  Button,
  Card,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
} from "./ui/primitives";

export function WeeklyClient({
  csrfToken,
  currentWeekStart,
  report,
  overallRoadmap,
  outstandingTopics,
  initialReflection,
}: {
  csrfToken: string;
  currentWeekStart: string;
  report: WeeklyReportSummary;
  overallRoadmap: RoadmapCompletionSummary;
  outstandingTopics: Topic[];
  initialReflection: Reflection | null;
}) {
  const router = useRouter();
  const [targetUnit, setTargetUnit] = useState<"hours" | "minutes">("hours");
  const [targetValue, setTargetValue] = useState(
    String(Math.round((report.weeklyTargetMinutes / 60) * 10) / 10)
  );
  const [savingGoal, setSavingGoal] = useState(false);

  const [learned, setLearned] = useState(initialReflection?.learned || "");
  const [practiced, setPracticed] = useState(
    initialReflection?.achievements || ""
  );
  const [difficult, setDifficult] = useState(
    initialReflection?.challenges || ""
  );
  const [revise, setRevise] = useState(initialReflection?.revisionItems || "");
  const [priorities, setPriorities] = useState(
    initialReflection?.nextPriorities || ""
  );
  const [savingRef, setSavingRef] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const navigateWeek = (mondayKey: string) => {
    router.push(`/weekly?week=${mondayKey}`);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingGoal) return;
    const numeric = Number(targetValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const targetMinutes =
      targetUnit === "hours" ? Math.round(numeric * 60) : Math.round(numeric);

    setSavingGoal(true);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          periodType: "weekly",
          periodKey: report.weekStart,
          targetMinutes,
        }),
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save weekly target.");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleSaveReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef) return;
    setSavingRef(true);
    setToast(null);
    try {
      await apiFetch("/api/reflections", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          periodType: "weekly",
          periodKey: report.weekStart,
          learned,
          achievements: practiced,
          challenges: difficult,
          revisionItems: revise,
          nextPriorities: priorities,
        }),
      });
      setToast("Weekly reflection saved.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save reflection.");
    } finally {
      setSavingRef(false);
    }
  };

  const chartData = report.dailyBreakdown.map((d) => ({
    day: formatShortDay(d.dateKey),
    dateKey: d.dateKey,
    minutes: d.minutes,
    sessions: d.sessions,
  }));

  return (
    <div className="space-y-6">
      {/* Header & Week Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Weekly Progress Report (Monday – Sunday)
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatDisplayDate(report.weekStart)} —{" "}
            {formatDisplayDate(report.weekEnd)}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek(addDaysToDateKey(report.weekStart, -7))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev Week
          </Button>
          {report.weekStart !== currentWeekStart ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigateWeek(currentWeekStart)}
            >
              This Week
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek(addDaysToDateKey(report.weekStart, 7))}
          >
            Next Week <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Clear Distinction: Time-Based Weekly Target vs Roadmap Curriculum Completion */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Time-Based Weekly Goal
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {report.weeklyTimeGoalPercentage}%{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({formatMinutesHuman(report.totalMinutes)} /{" "}
                  {formatMinutesHuman(report.weeklyTargetMinutes)})
                </span>
              </h2>
            </div>
            <Target className="h-5 w-5 text-emerald-500" />
          </div>
          <ProgressBar value={report.weeklyTimeGoalPercentage} className="mt-3" />

          <form
            onSubmit={handleSaveTarget}
            className="mt-4 flex flex-wrap items-center gap-2 text-xs"
          >
            <span className="text-slate-500">Set weekly time target:</span>
            <input
              type="number"
              min={1}
              step="any"
              aria-label="Weekly target value"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900"
            />
            <select
              aria-label="Weekly target unit"
              value={targetUnit}
              onChange={(e) => {
                const nextU = e.target.value as "hours" | "minutes";
                setTargetUnit(nextU);
                setTargetValue(
                  nextU === "hours"
                    ? String(
                        Math.round((report.weeklyTargetMinutes / 60) * 10) / 10
                      )
                    : String(report.weeklyTargetMinutes)
                );
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="hours">Hours</option>
              <option value="minutes">Minutes</option>
            </select>
            <Button type="submit" variant="secondary" size="sm" disabled={savingGoal}>
              Update Target
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                Curriculum Topic Mastery (Cumulative)
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {overallRoadmap.completionPercentage}%{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({overallRoadmap.completedTopicsCount} /{" "}
                  {overallRoadmap.eligibleTopicsCount} topics)
                </span>
              </h2>
            </div>
            <CheckCircle2 className="h-5 w-5 text-sky-500" />
          </div>
          <ProgressBar
            value={overallRoadmap.completionPercentage}
            barClassName="bg-sky-500"
            className="mt-3"
          />
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            <strong>{report.topicsCompletedCount}</strong> primary topic(s)
            completed during this week ·{" "}
            <strong>{report.topicsStudiedCount}</strong> topic(s) actively studied.
          </p>
        </Card>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total Study Hours</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {report.totalHours}h
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.totalSessions} study session(s)
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Week-over-Week Change</p>
          <div className="mt-1 flex items-center gap-1.5">
            {report.weekOverWeekDeltaMinutes >= 0 ? (
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-rose-500" />
            )}
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {report.weekOverWeekDeltaMinutes >= 0 ? "+" : "-"}
              {formatMinutesHuman(Math.abs(report.weekOverWeekDeltaMinutes))}
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Prev week: {formatMinutesHuman(report.previousWeekMinutes)} (
            {report.weekOverWeekChangePercent ?? 0}%)
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Weekly Consistency</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {report.consistencyPercentage}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.activeDaysCount} of 7 days with recorded study
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Daily Goal Achievement</p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">
            {report.daysMeetingDailyGoal} / 7 days
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Met {formatMinutesHuman(report.dailyTargetMinutes)} daily benchmark
          </p>
        </Card>
      </div>

      {/* Daily Breakdown Chart & Outstanding Planned Topics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Daily Study-Time Breakdown (Mon – Sun)
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Click any date below to inspect that day&apos;s detailed log
          </p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.35} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e1525",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Bar dataKey="minutes" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs">
            {report.dailyBreakdown.map((d) => (
              <Link
                key={d.dateKey}
                href={`/daily?date=${d.dateKey}`}
                className={`rounded-lg border p-2 transition-colors ${
                  d.goalAchieved
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-slate-200 hover:border-emerald-500/30 dark:border-slate-800"
                }`}
              >
                <div className="font-medium">{formatShortDay(d.dateKey)}</div>
                <div className="mt-0.5 font-mono text-[11px]">
                  {formatMinutesHuman(d.minutes)}
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Outstanding Planned Topics
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Topics currently in progress, needing revision, or scheduled
          </p>

          {outstandingTopics.length === 0 ? (
            <p className="text-xs text-slate-500">
              All planned topics for this period are clear!
            </p>
          ) : (
            <div className="space-y-2.5">
              {outstandingTopics.map((t) => (
                <Link
                  key={t.id}
                  href={`/roadmap/${t.id}`}
                  className="block rounded-xl border border-slate-200 p-3 hover:border-emerald-500/40 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {t.title}
                    </span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {t.plannedDate ? `Due: ${t.plannedDate}` : t.estimatedDuration}
                    </span>
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5-Part Weekly Reflection Form */}
      <Card className="p-5">
        <form onSubmit={handleSaveReflection} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Weekly Retrospective &amp; Next Week&apos;s Plan
              </h2>
              <p className="text-xs text-slate-500">
                Persisted for week starting {report.weekStart}
              </p>
            </div>
            <Button type="submit" size="sm" disabled={savingRef}>
              <Save className="h-3.5 w-3.5" />
              <span>{savingRef ? "Saving..." : "Save Weekly Reflection"}</span>
            </Button>
          </div>

          {toast ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
              {toast}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="wk-learned"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                1. What I learned
              </label>
              <textarea
                id="wk-learned"
                rows={3}
                value={learned}
                onChange={(e) => setLearned(e.target.value)}
                placeholder="Core theories, attack surfaces, defensive controls..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="wk-practiced"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                2. What I practiced
              </label>
              <textarea
                id="wk-practiced"
                rows={3}
                value={practiced}
                onChange={(e) => setPracticed(e.target.value)}
                placeholder="Labs, TryHackMe/HTB rooms, packet analysis, scripts..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="wk-difficult"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                3. What I found difficult
              </label>
              <textarea
                id="wk-difficult"
                rows={3}
                value={difficult}
                onChange={(e) => setDifficult(e.target.value)}
                placeholder="Challenging concepts, debugging hurdles..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="wk-revise"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                4. What I need to revise
              </label>
              <textarea
                id="wk-revise"
                rows={3}
                value={revise}
                onChange={(e) => setRevise(e.target.value)}
                placeholder="Topics, commands, or protocols to review..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="wk-priorities"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              5. My next week&apos;s priorities
            </label>
            <textarea
              id="wk-priorities"
              rows={2}
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              placeholder="Top 2–3 concrete goals for next week..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </form>
      </Card>
    </div>
  );
}
