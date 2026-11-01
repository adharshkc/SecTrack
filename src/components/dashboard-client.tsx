"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Play,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type {
  DailySummary,
  PhaseProgressItem,
  RoadmapCompletionSummary,
  StreakResult,
} from "@/lib/analytics";
import { formatDisplayDate, formatMinutesHuman } from "@/lib/dates";
import type { StudySession, Topic } from "@/lib/types";
import { StudySessionModal } from "./session-modal";
import {
  Button,
  Card,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
} from "./ui/primitives";

export function DashboardClient({
  csrfToken,
  todayKey,
  overall,
  phaseProgress,
  streaks,
  dailySummary,
  weekMinutes,
  weeklyTargetMinutes,
  monthMinutes,
  monthlyTargetMinutes,
  dailySeries,
  weeklySeries,
  monthlySeries,
  recentSessions,
  continueTopic,
  upcomingTopics,
  overdueTopics,
  todaysTopics,
  allTopics,
  hasStartedTracking,
}: {
  csrfToken: string;
  todayKey: string;
  overall: RoadmapCompletionSummary;
  phaseProgress: PhaseProgressItem[];
  streaks: StreakResult;
  dailySummary: DailySummary;
  weekMinutes: number;
  weeklyTargetMinutes: number;
  monthMinutes: number;
  monthlyTargetMinutes: number;
  dailySeries: Array<{ label: string; dateKey: string; minutes: number }>;
  weeklySeries: Array<{ label: string; minutes: number }>;
  monthlySeries: Array<{ label: string; hours: number }>;
  recentSessions: Array<StudySession & { topicTitle: string }>;
  continueTopic: Topic | null;
  upcomingTopics: Topic[];
  overdueTopics: Topic[];
  todaysTopics: Topic[];
  allTopics: Topic[];
  hasStartedTracking: boolean;
}) {
  const router = useRouter();
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  const summaryCards = [
    {
      title: "Overall Completion",
      value: `${overall.completionPercentage}%`,
      sub: `${overall.completedTopicsCount} / ${overall.eligibleTopicsCount} primary topics`,
      icon: Layers,
      accent: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Topics Completed",
      value: String(overall.completedTopicsCount),
      sub: `${overall.completedSubtopicsCount} / ${overall.totalSubtopicsCount} subtopics mastered`,
      icon: CheckCircle2,
      accent: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "In Progress",
      value: String(overall.inProgressTopicsCount + overall.practicedTopicsCount),
      sub: `${overall.inProgressTopicsCount} active · ${overall.practicedTopicsCount} practiced`,
      icon: TrendingUp,
      accent: "text-sky-500 bg-sky-500/10",
    },
    {
      title: "Study Time (Week)",
      value: formatMinutesHuman(weekMinutes),
      sub: `Target: ${formatMinutesHuman(weeklyTargetMinutes)}`,
      icon: Clock,
      accent: "text-teal-500 bg-teal-500/10",
    },
    {
      title: "Study Time (Month)",
      value: formatMinutesHuman(monthMinutes),
      sub: `Target: ${formatMinutesHuman(monthlyTargetMinutes)}`,
      icon: CalendarClock,
      accent: "text-indigo-500 bg-indigo-500/10",
    },
    {
      title: "Current Streak",
      value: `${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`,
      sub: `Longest: ${streaks.longestStreak}d · ${streaks.totalActiveDays} active days`,
      icon: Flame,
      accent: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Daily Goal",
      value: `${Math.min(999, dailySummary.goalPercentage)}%`,
      sub: `${formatMinutesHuman(dailySummary.totalMinutes)} / ${formatMinutesHuman(
        dailySummary.targetMinutes
      )} today`,
      icon: Target,
      accent: dailySummary.goalAchieved
        ? "text-emerald-500 bg-emerald-500/10"
        : "text-slate-400 bg-slate-500/10",
    },
    {
      title: "Upcoming Topics",
      value: String(upcomingTopics.length + overdueTopics.length),
      sub:
        overdueTopics.length > 0
          ? `${overdueTopics.length} overdue · ${upcomingTopics.length} planned`
          : "Next queued curriculum modules",
      icon: Sparkles,
      accent:
        overdueTopics.length > 0
          ? "text-rose-500 bg-rose-500/10"
          : "text-emerald-500 bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {formatDisplayDate(todayKey)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cybersecurity Command Center
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Track daily labs, weekly consistency, and mastery across the 5-phase{" "}
            <a
              href="https://www.itshahirx.com/roadmap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              itshahirx roadmap
            </a>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {continueTopic ? (
            <Link href={`/roadmap/${continueTopic.id}`}>
              <Button variant="outline">
                <Play className="h-4 w-4 text-emerald-500" />
                <span>Continue: {continueTopic.title.slice(0, 24)}</span>
              </Button>
            </Link>
          ) : null}
          <Button onClick={() => setSessionModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Quick-Add Study Session</span>
          </Button>
        </div>
      </div>

      {/* Onboarding Banner when user hasn't started tracking yet */}
      {!hasStartedTracking ? (
        <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Welcome to Your Cybersecurity Journey
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Your 5-Phase Roadmap ({overall.eligibleTopicsCount} Topics &amp;{" "}
                {overall.totalSubtopicsCount} Subtopics) is Ready
              </h2>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Start with <strong>Phase 1: Foundation → Operating Systems</strong>, mark
                a topic <em>In Progress</em>, or log your first study session to ignite
                your learning streak and populate your charts.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/roadmap">
                <Button variant="secondary" size="sm">
                  Explore Roadmap
                </Button>
              </Link>
              <Button size="sm" onClick={() => setSessionModalOpen(true)}>
                Log First Session
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 8 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {card.title}
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-lg p-2 ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {card.sub}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Phase Progress Bars & Today's Goals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Roadmap Mastery by Phase
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trackable topic completion across all 5 canonical phases
              </p>
            </div>
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Open Explorer <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {phaseProgress.map((p) => (
              <div key={p.phaseId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {p.title}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {p.completedTopics}/{p.totalTopics} ({p.percentage}%)
                  </span>
                </div>
                <ProgressBar value={p.percentage} />
              </div>
            ))}
          </div>
        </Card>

        {/* Today's Learning Goals */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Today&apos;s Learning Goals
              </h2>
              <Link
                href="/daily"
                className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Daily Log
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Study Time Target
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatMinutesHuman(dailySummary.totalMinutes)} /{" "}
                  {formatMinutesHuman(dailySummary.targetMinutes)}
                </span>
              </div>
              <ProgressBar value={dailySummary.goalPercentage} className="mt-2" />
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {dailySummary.goalAchieved
                  ? "Daily study target achieved!"
                  : `${formatMinutesHuman(
                      Math.max(
                        0,
                        dailySummary.targetMinutes - dailySummary.totalMinutes
                      )
                    )} remaining to reach today's goal.`}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Focus Topics
              </p>
              {todaysTopics.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No active topics yet. Pick your next topic from the roadmap!
                </p>
              ) : (
                todaysTopics.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    href={`/roadmap/${t.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs hover:border-emerald-500/40 dark:border-slate-800"
                  >
                    <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {t.title}
                    </span>
                    <StatusBadge status={t.status} />
                  </Link>
                ))
              )}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setSessionModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Record Today&apos;s Session</span>
          </Button>
        </Card>
      </div>

      {/* Analytics Charts: Daily, Weekly, Monthly */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Daily Study Time (Last 14 Days)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Minutes studied per day
            </p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries}>
                <defs>
                  <linearGradient id="dailyEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={32} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e1525",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#dailyEmerald)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Weekly Progress (Last 8 Weeks)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total minutes per Mon–Sun week
              </p>
            </div>
            <Link
              href="/weekly"
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Report
            </Link>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={35} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e1525",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Monthly Study Time (Last 6 Months)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total hours logged per month
              </p>
            </div>
            <Link
              href="/monthly"
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Report
            </Link>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={32} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e1525",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Bar dataKey="hours" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Learning Activity & Upcoming / Overdue Planned Topics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent Learning Activity
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest persisted study &amp; lab sessions
              </p>
            </div>
            <Link
              href="/daily"
              className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              View All
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No study sessions recorded yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Quick-Add Study Session&rdquo; after studying or completing a
                hands-on lab.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800/80"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/roadmap/${s.topicId}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-emerald-500 dark:text-slate-100"
                    >
                      {s.topicTitle}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {s.dateKey} · <span className="font-medium">{s.activityType}</span>
                      {s.outcome ? ` — ${s.outcome}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMinutesHuman(s.durationMinutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Upcoming &amp; Overdue Planned Topics
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scheduled study targets and recommended next modules
              </p>
            </div>
            <Link
              href="/roadmap"
              className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Roadmap
            </Link>
          </div>

          <div className="space-y-2.5">
            {overdueTopics.map((t) => (
              <Link
                key={t.id}
                href={`/roadmap/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 hover:border-rose-500/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
                    Overdue target: {t.plannedDate} · {t.estimatedDuration}
                  </p>
                </div>
                <PriorityBadge priority={t.priority} />
              </Link>
            ))}

            {upcomingTopics.map((t) => (
              <Link
                key={t.id}
                href={`/roadmap/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-emerald-500/40 dark:border-slate-800/80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {t.plannedDate
                      ? `Planned: ${t.plannedDate}`
                      : `Est. ${t.estimatedDuration}`}{" "}
                    · {t.difficulty}
                  </p>
                </div>
                <PriorityBadge priority={t.priority} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <StudySessionModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        csrfToken={csrfToken}
        topics={allTopics}
        defaultDateKey={todayKey}
        defaultTopicId={continueTopic?.id}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
