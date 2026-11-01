"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trophy,
} from "lucide-react";
import type { StreakResult } from "@/lib/analytics";
import {
  addMonthsToMonthKey,
  formatDisplayDate,
  formatMinutesHuman,
  formatMonthTitle,
  parseDateKeyToUtcNoon,
} from "@/lib/dates";
import type { StudySession } from "@/lib/types";
import { Button, Card } from "./ui/primitives";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarClient({
  monthKey,
  todayKey,
  days,
  streaks,
  sessionsInMonth,
  dailyTargetMinutes,
}: {
  monthKey: string;
  todayKey: string;
  days: string[];
  streaks: StreakResult;
  sessionsInMonth: Array<StudySession & { topicTitle: string }>;
  dailyTargetMinutes: number;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    days.includes(todayKey) ? todayKey : days[0]
  );

  // Align first day of month to Monday=0..Sunday=6
  const firstDowUtc = parseDateKeyToUtcNoon(days[0]).getUTCDay(); // 0=Sun..6=Sat
  const leadingBlanks = firstDowUtc === 0 ? 6 : firstDowUtc - 1;

  const minutesByDay = new Map<string, number>();
  for (const s of sessionsInMonth) {
    minutesByDay.set(s.dateKey, (minutesByDay.get(s.dateKey) ?? 0) + s.durationMinutes);
  }

  const selectedSessions = sessionsInMonth.filter((s) => s.dateKey === selectedDate);
  const selectedTotalMins = minutesByDay.get(selectedDate) ?? 0;

  const getCellStyle = (mins: number) => {
    if (mins <= 0)
      return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800";
    if (mins < 30)
      return "bg-emerald-500/15 text-emerald-800 border-emerald-500/30 dark:text-emerald-200";
    if (mins < 60)
      return "bg-emerald-500/35 text-emerald-950 border-emerald-500/40 dark:text-emerald-100";
    if (mins < 120)
      return "bg-emerald-500/65 text-white border-emerald-500/60";
    return "bg-emerald-500 text-white font-semibold border-emerald-400 shadow-xs";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Activity Calendar &amp; Learning Streaks
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatMonthTitle(monthKey)}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/calendar?month=${addMonthsToMonthKey(monthKey, -1)}`)
            }
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/calendar?month=${todayKey.slice(0, 7)}`)}
          >
            Current Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/calendar?month=${addMonthsToMonthKey(monthKey, 1)}`)
            }
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Streak Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Current Learning Streak</p>
            <Flame className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {streaks.currentStreak} day{streaks.currentStreak === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {streaks.studiedToday
              ? "Today's study session recorded!"
              : streaks.currentStreak > 0
                ? "Log a session today to extend your active streak"
                : "Record a valid study session today to start a streak"}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Longest Historical Streak</p>
            <Trophy className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-1 text-3xl font-bold text-emerald-500">
            {streaks.longestStreak} day{streaks.longestStreak === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Consecutive calendar days with valid study sessions
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Total Active Study Days</p>
            <CalendarIcon className="h-5 w-5 text-sky-500" />
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {streaks.totalActiveDays}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Last active: {streaks.lastActiveDateKey || "None yet"}
          </p>
        </Card>
      </div>

      {/* Calendar Grid + Selected Day Log Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
            {WEEKDAY_HEADERS.map((wd) => (
              <div key={wd}>{wd}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="h-16" />
            ))}

            {days.map((dateKey) => {
              const mins = minutesByDay.get(dateKey) ?? 0;
              const isSelected = selectedDate === dateKey;
              const isToday = dateKey === todayKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`flex h-16 flex-col items-center justify-center rounded-xl border p-1.5 transition-all cursor-pointer ${getCellStyle(
                    mins
                  )} ${
                    isSelected
                      ? "ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-[#0e1525]"
                      : ""
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {Number(dateKey.slice(8))}
                    {isToday ? "•" : ""}
                  </span>
                  <span className="mt-1 font-mono text-[10px]">
                    {mins > 0 ? formatMinutesHuman(mins) : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
            <span>
              Streaks require at least 1 persisted study session per calendar day.
            </span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className="h-3 w-3 rounded-xs bg-slate-200 dark:bg-slate-800" />
              <span className="h-3 w-3 rounded-xs bg-emerald-500/20" />
              <span className="h-3 w-3 rounded-xs bg-emerald-500/45" />
              <span className="h-3 w-3 rounded-xs bg-emerald-500/75" />
              <span className="h-3 w-3 rounded-xs bg-emerald-500" />
              <span>More (120m+)</span>
            </div>
          </div>
        </Card>

        {/* Selected Date Learning Log Panel */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Selected Day Log
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {formatDisplayDate(selectedDate)}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Total: <strong>{formatMinutesHuman(selectedTotalMins)}</strong> (Daily
              goal: {formatMinutesHuman(dailyTargetMinutes)})
            </p>

            <div className="mt-4 space-y-2.5">
              {selectedSessions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-slate-800">
                  No study sessions logged on {selectedDate}.
                </p>
              ) : (
                selectedSessions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {s.activityType}
                      </span>
                      <span className="font-mono font-semibold">
                        {formatMinutesHuman(s.durationMinutes)}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                      {s.topicTitle}
                    </p>
                    {s.outcome ? (
                      <p className="mt-0.5 text-slate-500">{s.outcome}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <Link href={`/daily?date=${selectedDate}`} className="mt-4 block">
            <Button className="w-full" size="sm">
              <span>Open Full Daily Log</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
