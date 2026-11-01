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
  ChevronLeft,
  ChevronRight,
  Flame,
  RotateCcw,
  Save,
  Target,
} from "lucide-react";
import type { MonthlyReportSummary, StreakResult } from "@/lib/analytics";
import {
  addMonthsToMonthKey,
  formatMinutesHuman,
  formatMonthTitle,
} from "@/lib/dates";
import type { Reflection, Topic } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { Button, Card, ProgressBar, StatusBadge } from "./ui/primitives";

export function MonthlyClient({
  csrfToken,
  currentMonthKey,
  report,
  streaks,
  revisionTopics,
  initialReflection,
}: {
  csrfToken: string;
  currentMonthKey: string;
  report: MonthlyReportSummary;
  streaks: StreakResult;
  revisionTopics: Topic[];
  initialReflection: Reflection | null;
}) {
  const router = useRouter();

  const [targetHours, setTargetHours] = useState(
    String(Math.round((report.targets.targetMinutes / 60) * 10) / 10)
  );
  const [targetTopics, setTargetTopics] = useState(
    String(report.targets.targetTopics)
  );
  const [targetLabs, setTargetLabs] = useState(String(report.targets.targetLabs));
  const [savingTargets, setSavingTargets] = useState(false);

  const [learned, setLearned] = useState(initialReflection?.learned || "");
  const [achievements, setAchievements] = useState(
    initialReflection?.achievements || ""
  );
  const [challenges, setChallenges] = useState(
    initialReflection?.challenges || ""
  );
  const [revisionItems, setRevisionItems] = useState(
    initialReflection?.revisionItems || ""
  );
  const [nextPriorities, setNextPriorities] = useState(
    initialReflection?.nextPriorities || ""
  );
  const [savingRef, setSavingRef] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const navigateMonth = (mk: string) => {
    router.push(`/monthly?month=${mk}`);
  };

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingTargets) return;
    setSavingTargets(true);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          periodType: "monthly",
          periodKey: report.monthKey,
          targetMinutes: Math.max(0, Math.round((Number(targetHours) || 0) * 60)),
          targetCompletedTopics: Math.max(0, Math.round(Number(targetTopics) || 0)),
          targetCompletedLabs: Math.max(0, Math.round(Number(targetLabs) || 0)),
        }),
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save monthly targets.");
    } finally {
      setSavingTargets(false);
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
          periodType: "monthly",
          periodKey: report.monthKey,
          learned,
          achievements,
          challenges,
          revisionItems,
          nextPriorities,
        }),
      });
      setToast("Monthly reflection saved.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save reflection.");
    } finally {
      setSavingRef(false);
    }
  };

  const heatClass = (mins: number) => {
    if (mins <= 0)
      return "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500";
    if (mins < 30)
      return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30";
    if (mins < 60)
      return "bg-emerald-500/40 text-emerald-900 dark:text-emerald-100 border-emerald-500/40";
    if (mins < 120)
      return "bg-emerald-500/70 text-white border-emerald-500/60";
    return "bg-emerald-500 text-white font-semibold border-emerald-400";
  };

  return (
    <div className="space-y-6">
      {/* Header & Month/Year Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Monthly Progress Report
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatMonthTitle(report.monthKey)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(addMonthsToMonthKey(report.monthKey, -1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <input
            type="month"
            aria-label="Select month and year"
            value={report.monthKey}
            onChange={(e) => e.target.value && navigateMonth(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          {report.monthKey !== currentMonthKey ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigateMonth(currentMonthKey)}
            >
              Current Month
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(addMonthsToMonthKey(report.monthKey, 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total Study Hours</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {report.totalHours}h
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.totalSessions} total session(s)
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Topics Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">
            {report.topicsCompletedInMonth}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.practicalLabSessions} practical lab/CTF session(s)
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Roadmap Progress Shift</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
            {report.roadmapProgressStartOfMonth}% →{" "}
            <span className="text-emerald-500">
              {report.roadmapProgressEndOfMonth}%
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Beginning vs. end of month
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Daily Goal Rate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {report.dailyGoalAchievementRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.daysMeetingDailyGoal} day(s) met daily target
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Learning Streaks</p>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {report.longestStreakInMonth}d{" "}
            <span className="text-xs font-normal text-slate-500">in month</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Current: {streaks.currentStreak}d · All-time: {streaks.longestStreak}d
          </p>
        </Card>
      </div>

      {/* 3 Separate Monthly Targets */}
      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Monthly Target Achievement
              </h2>
              <p className="text-xs text-slate-500">
                Separate completion percentages for hours, topics, and practical labs
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSaveTargets}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <label className="flex items-center gap-1">
              <span className="text-slate-500">Hours:</span>
              <input
                type="number"
                min={0}
                step="any"
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-slate-500">Topics:</span>
              <input
                type="number"
                min={0}
                value={targetTopics}
                onChange={(e) => setTargetTopics(e.target.value)}
                className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-slate-500">Labs:</span>
              <input
                type="number"
                min={0}
                value={targetLabs}
                onChange={(e) => setTargetLabs(e.target.value)}
                className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={savingTargets}
            >
              Save Targets
            </Button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="font-medium">1. Total Learning Hours</span>
              <span className="font-mono font-semibold text-emerald-500">
                {report.targets.hoursPercentage}%
              </span>
            </div>
            <p className="mt-1 text-sm font-bold">
              {formatMinutesHuman(report.totalMinutes)} /{" "}
              {formatMinutesHuman(report.targets.targetMinutes)}
            </p>
            <ProgressBar value={report.targets.hoursPercentage} className="mt-2" />
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="font-medium">2. Topics Completed</span>
              <span className="font-mono font-semibold text-sky-500">
                {report.targets.topicsPercentage}%
              </span>
            </div>
            <p className="mt-1 text-sm font-bold">
              {report.topicsCompletedInMonth} / {report.targets.targetTopics} topics
            </p>
            <ProgressBar
              value={report.targets.topicsPercentage}
              barClassName="bg-sky-500"
              className="mt-2"
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="font-medium">3. Practical Labs Completed</span>
              <span className="font-mono font-semibold text-teal-500">
                {report.targets.labsPercentage}%
              </span>
            </div>
            <p className="mt-1 text-sm font-bold">
              {report.practicalLabSessions} / {report.targets.targetLabs} lab/CTF
              sessions
            </p>
            <ProgressBar
              value={report.targets.labsPercentage}
              barClassName="bg-teal-500"
              className="mt-2"
            />
          </div>
        </div>
      </Card>

      {/* Phase Distribution & Weekly Breakdown Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Study-Time Distribution Across Phases
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Hours invested in each phase during {formatMonthTitle(report.monthKey)}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.phaseDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.35} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis
                  type="category"
                  dataKey="phaseTitle"
                  width={120}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e1525",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Bar dataKey="hours" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Weekly Breakdown Within Month
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Minutes logged across each week segment of the month
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.weeklyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
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
                <Bar dataKey="minutes" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Monthly Activity Calendar & Topics Requiring Revision */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Daily Learning Activity Calendar
              </h3>
              <p className="text-xs text-slate-500">
                {report.activeDaysCount} active learning day(s) — click any day to
                open its log
              </p>
            </div>
            <Link
              href="/calendar"
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Full Calendar →
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {report.dailyCalendar.map((day) => (
              <Link
                key={day.dateKey}
                href={`/daily?date=${day.dateKey}`}
                className={`flex flex-col items-center justify-center rounded-lg border border-transparent p-2 text-xs transition-transform hover:scale-105 ${heatClass(
                  day.minutes
                )}`}
              >
                <span className="font-mono text-[11px]">
                  {Number(day.dateKey.slice(8))}
                </span>
                <span className="mt-0.5 font-mono text-[10px]">
                  {day.minutes > 0 ? formatMinutesHuman(day.minutes) : "—"}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amber-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Topics Requiring Revision ({revisionTopics.length})
            </h3>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Topics marked &ldquo;Needs Revision&rdquo; or low confidence (1–2/5)
          </p>

          {revisionTopics.length === 0 ? (
            <p className="text-xs text-slate-500">
              No topics currently flagged for revision.
            </p>
          ) : (
            <div className="space-y-2">
              {revisionTopics.slice(0, 6).map((t) => (
                <Link
                  key={t.id}
                  href={`/roadmap/${t.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs hover:border-amber-500/40 dark:border-slate-800"
                >
                  <span className="truncate font-medium">{t.title}</span>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly Reflection */}
      <Card className="p-5">
        <form onSubmit={handleSaveReflection} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Monthly Reflection — {formatMonthTitle(report.monthKey)}
              </h2>
              <p className="text-xs text-slate-500">
                Consolidate breakthroughs, skill gaps, and next month&apos;s roadmap
                strategy
              </p>
            </div>
            <Button type="submit" size="sm" disabled={savingRef}>
              <Save className="h-3.5 w-3.5" />
              <span>{savingRef ? "Saving..." : "Save Monthly Reflection"}</span>
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
                htmlFor="mo-learned"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Core Capabilities Gained
              </label>
              <textarea
                id="mo-learned"
                rows={3}
                value={learned}
                onChange={(e) => setLearned(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="mo-achievements"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Labs, CTFs &amp; Milestones Completed
              </label>
              <textarea
                id="mo-achievements"
                rows={3}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="mo-challenges"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Biggest Challenges &amp; Bottlenecks
              </label>
              <textarea
                id="mo-challenges"
                rows={3}
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="mo-priorities"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Next Month&apos;s Strategic Focus
              </label>
              <textarea
                id="mo-priorities"
                rows={3}
                value={nextPriorities}
                onChange={(e) => setNextPriorities(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
