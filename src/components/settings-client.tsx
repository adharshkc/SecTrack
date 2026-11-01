"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Download,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { ConfiguredAuthMode } from "@/lib/auth/session";
import type { UserSettings } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { Button, Card } from "./ui/primitives";

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function SettingsClient({
  csrfToken,
  settings,
  authMode,
  storageProvider,
}: {
  csrfToken: string;
  settings: UserSettings;
  authMode: ConfiguredAuthMode;
  storageProvider: string;
}) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(settings.timezone);
  const [dailyMins, setDailyMins] = useState(String(settings.dailyTargetMinutes));
  const [weeklyMins, setWeeklyMins] = useState(
    String(settings.weeklyTargetMinutes)
  );
  const [monthlyMins, setMonthlyMins] = useState(
    String(settings.monthlyTargetMinutes)
  );
  const [monthlyTopics, setMonthlyTopics] = useState(
    String(settings.monthlyTargetTopics)
  );
  const [monthlyLabs, setMonthlyLabs] = useState(
    String(settings.monthlyTargetLabs)
  );

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Safe JSON Import
  const [importMode, setImportMode] = useState<"skip_existing" | "merge">(
    "skip_existing"
  );
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Scrypt Hash Generator
  const [candidatePass, setCandidatePass] = useState("");
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPrefs) return;
    setSavingPrefs(true);
    setPrefsMsg(null);
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        csrfToken,
        body: JSON.stringify({
          timezone,
          dailyTargetMinutes: Number(dailyMins) || 90,
          weeklyTargetMinutes: Number(weeklyMins) || 540,
          monthlyTargetMinutes: Number(monthlyMins) || 2400,
          monthlyTargetTopics: Number(monthlyTopics) || 4,
          monthlyTargetLabs: Number(monthlyLabs) || 8,
        }),
      });
      setPrefsMsg("Preferences & study targets updated.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleRoadmapSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await apiFetch<{
        created: number;
        updated: number;
        preservedCustom: number;
      }>("/api/roadmap/seed", {
        method: "POST",
        csrfToken,
      });
      setSyncMsg(
        `Sync complete: ${res.created} added, ${res.updated} verified/preserved, ${res.preservedCustom} custom topic(s) untouched.`
      );
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importing) return;
    setImporting(true);
    setImportMsg(null);

    try {
      const text = await file.text();
      const parsedJson = JSON.parse(text);
      const res = await apiFetch<{
        imported: {
          topics: number;
          studySessions: number;
          completionEvents: number;
          goals: number;
          reflections: number;
        };
      }>("/api/export", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          mode: importMode,
          payload: parsedJson,
        }),
      });

      setImportMsg(
        `Imported ${res.imported.topics} topic(s), ${res.imported.studySessions} session(s), ${res.imported.completionEvents} completion event(s), and ${res.imported.reflections} reflection(s).`
      );
      router.refresh();
    } catch (err) {
      setImportMsg(
        `Import rejected: ${
          err instanceof Error ? err.message : "Invalid JSON backup file."
        }`
      );
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleGenerateHash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hashing || candidatePass.length < 10) return;
    setHashing(true);
    setGeneratedHash(null);
    try {
      const res = await apiFetch<{ hash: string }>("/api/auth/hash", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({ password: candidatePass }),
      });
      setGeneratedHash(res.hash);
      setCandidatePass("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate hash.");
    } finally {
      setHashing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings, Data Export &amp; Security
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Configure timezone, study targets, logical backups, and authentication
          diagnostics
        </p>
      </div>

      {/* Preferences & Default Targets */}
      <Card className="p-5">
        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Timezone &amp; Default Learning Targets
              </h2>
              <p className="text-xs text-slate-500">
                Asia/Kolkata is the default timezone for date keys and streak
                boundaries
              </p>
            </div>
            <Button type="submit" size="sm" disabled={savingPrefs}>
              <Save className="h-3.5 w-3.5" />
              <span>{savingPrefs ? "Saving..." : "Save Settings"}</span>
            </Button>
          </div>

          {prefsMsg ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
              {prefsMsg}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="set-tz"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Application Timezone (IANA)
              </label>
              <select
                id="set-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="set-daily"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Default Daily Goal (minutes)
              </label>
              <input
                id="set-daily"
                type="number"
                min={5}
                max={1440}
                value={dailyMins}
                onChange={(e) => setDailyMins(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="set-weekly"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Default Weekly Goal (minutes)
              </label>
              <input
                id="set-weekly"
                type="number"
                min={15}
                max={10080}
                value={weeklyMins}
                onChange={(e) => setWeeklyMins(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="set-monthly-mins"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Default Monthly Goal (minutes)
              </label>
              <input
                id="set-monthly-mins"
                type="number"
                min={30}
                value={monthlyMins}
                onChange={(e) => setMonthlyMins(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="set-monthly-topics"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Default Monthly Topics Target
              </label>
              <input
                id="set-monthly-topics"
                type="number"
                min={0}
                value={monthlyTopics}
                onChange={(e) => setMonthlyTopics(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="set-monthly-labs"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Default Monthly Practical Labs Target
              </label>
              <input
                id="set-monthly-labs"
                type="number"
                min={0}
                value={monthlyLabs}
                onChange={(e) => setMonthlyLabs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </form>
      </Card>

      {/* Data Export, CSV & Safe Validated Backup Import */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Data Export &amp; Logical Backup
              </h2>
              <p className="text-xs text-slate-500">
                Includes schemaVersion 1.0.0 — excludes all secrets, cookies, and
                server credentials
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <a href="/api/export?format=json" download className="block">
              <Button variant="primary" className="w-full justify-between">
                <span>Download Complete JSON Backup (v1.0.0)</span>
                <Download className="h-4 w-4" />
              </Button>
            </a>

            <a href="/api/export?format=sessions_csv" download className="block">
              <Button variant="outline" className="w-full justify-between">
                <span>Export Study Sessions (CSV)</span>
                <Download className="h-4 w-4" />
              </Button>
            </a>

            <a href="/api/export?format=topics_csv" download className="block">
              <Button variant="outline" className="w-full justify-between">
                <span>Export Topic &amp; Subtopic Progress (CSV)</span>
                <Download className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-sky-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Safe Validated JSON Backup Restore
              </h2>
              <p className="text-xs text-slate-500">
                Zod-validated schema check preventing accidental overwrites
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="import-mode"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Conflict Handling Mode
            </label>
            <select
              id="import-mode"
              value={importMode}
              onChange={(e) =>
                setImportMode(e.target.value as "skip_existing" | "merge")
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="skip_existing">
                Safe (Skip Existing IDs — Never Overwrite Current Records)
              </option>
              <option value="merge">
                Merge / Upsert Matching Record IDs
              </option>
            </select>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-600 hover:border-emerald-500 dark:border-slate-700 dark:text-slate-300">
            <span className="font-semibold">
              {importing
                ? "Validating & importing..."
                : "Select JSON Backup File (.json)"}
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
          </label>

          {importMsg ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              {importMsg}
            </p>
          ) : null}
        </Card>
      </div>

      {/* Roadmap Sync & Security Diagnostics / Hash Generator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Canonical Roadmap Synchronization
              </h2>
              <p className="text-xs text-slate-500">
                Source: {settings.roadmapSourceUrl} · Seeded version:{" "}
                {settings.roadmapSeededVersion || "1.0.0"}
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Re-running the importer verifies all 5 phases, 12 sections, 36 primary
            topics, and 160 subtopics while strictly preserving your existing
            topic statuses, notes, custom topics, study sessions, and completion
            history.
          </p>

          {syncMsg ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-300">
              {syncMsg}
            </p>
          ) : null}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRoadmapSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Re-Verify & Sync Roadmap"}</span>
          </Button>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Security Diagnostics &amp; scrypt Hash Generator
              </h2>
              <p className="text-xs text-slate-500">
                Auth mode: <code className="font-mono">{authMode}</code> · Storage:{" "}
                <code className="font-mono uppercase">{storageProvider}</code>
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateHash} className="space-y-2">
            <label
              htmlFor="hash-gen-pass"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
              Generate <code className="font-mono">APP_PASSWORD_HASH</code> for
              Vercel Environment Variables
            </label>
            <div className="flex gap-2">
              <input
                id="hash-gen-pass"
                type="password"
                minLength={10}
                placeholder="Enter password (min 10 chars)..."
                value={candidatePass}
                onChange={(e) => setCandidatePass(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={hashing}>
                {hashing ? "..." : "Generate"}
              </Button>
            </div>
          </form>

          {generatedHash ? (
            <div className="rounded-lg border border-emerald-500/30 bg-slate-950 p-2.5">
              <p className="text-[10px] text-slate-400">
                Copy into <code>.env</code> as <code>APP_PASSWORD_HASH</code> (each <code>$</code> escaped as <code>\$</code>):
              </p>
              <code className="mt-1 block break-all font-mono text-[11px] text-emerald-300">
                {generatedHash.replace(/\$/g, "\\$")}
              </code>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
