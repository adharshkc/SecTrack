"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  HelpCircle,
  Save,
  Search,
  Terminal,
} from "lucide-react";
import type { Reflection, RoadmapPhase, Topic } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { Button, Card, MarkdownPreview, StatusBadge } from "./ui/primitives";

export function NotesClient({
  csrfToken,
  topics,
  phases,
  reflections,
}: {
  csrfToken: string;
  topics: Topic[];
  phases: RoadmapPhase[];
  reflections: Reflection[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"topics" | "commands" | "questions" | "reflections">(
    "topics"
  );

  // Quick Note Writer
  const primaryTopics = useMemo(
    () => topics.filter((t) => !t.parentTopicId),
    [topics]
  );
  const [quickTopicId, setQuickTopicId] = useState(primaryTopics[0]?.id || "");
  const selectedTopic = topics.find((t) => t.id === quickTopicId);
  const [quickNote, setQuickNote] = useState(selectedTopic?.notes || "");
  const [savingNote, setSavingNote] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSelectQuickTopic = (id: string) => {
    setQuickTopicId(id);
    const found = topics.find((t) => t.id === id);
    setQuickNote(found?.notes || "");
    setSavedMsg(null);
  };

  const handleSaveQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTopicId || savingNote) return;
    setSavingNote(true);
    setSavedMsg(null);
    try {
      await apiFetch(`/api/topics/${quickTopicId}`, {
        method: "PATCH",
        csrfToken,
        body: JSON.stringify({ notes: quickNote }),
      });
      setSavedMsg("Notes saved to topic.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const q = search.trim().toLowerCase();

  const topicsWithNotes = topics.filter(
    (t) =>
      t.notes.trim().length > 0 &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q))
  );

  const topicsWithCommands = topics.filter(
    (t) =>
      t.commandsLearned.trim().length > 0 &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.commandsLearned.toLowerCase().includes(q))
  );

  const topicsWithQuestions = topics.filter(
    (t) =>
      t.questionsToRevisit.trim().length > 0 &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.questionsToRevisit.toLowerCase().includes(q))
  );

  const filteredReflections = reflections.filter(
    (r) =>
      !q ||
      r.periodKey.toLowerCase().includes(q) ||
      r.learned.toLowerCase().includes(q) ||
      r.achievements.toLowerCase().includes(q) ||
      r.challenges.toLowerCase().includes(q)
  );

  const phaseMap = new Map(phases.map((p) => [p.id, p.shortTitle]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cybersecurity Knowledge Base &amp; Notes
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Centralized Markdown notes, CLI commands, open questions, and study
          reflections
        </p>
      </div>

      {/* Quick Markdown Note Editor */}
      <Card className="p-5">
        <form onSubmit={handleSaveQuickNote} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="quick-note-topic"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Quick Note Editor:
              </label>
              <select
                id="quick-note-topic"
                value={quickTopicId}
                onChange={(e) => handleSelectQuickTopic(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {primaryTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {savedMsg ? (
                <span className="text-xs text-emerald-500">{savedMsg}</span>
              ) : null}
              <Button type="submit" size="sm" disabled={savingNote}>
                <Save className="h-3.5 w-3.5" />
                <span>{savingNote ? "Saving..." : "Save Note"}</span>
              </Button>
            </div>
          </div>

          <textarea
            rows={4}
            aria-label="Quick topic markdown notes"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Write Markdown notes, commands (`nmap -sV`), or key takeaways for the selected topic..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </form>
      </Card>

      {/* Search & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            {
              id: "topics" as const,
              label: `Topic Notes (${topicsWithNotes.length})`,
              icon: FileText,
            },
            {
              id: "commands" as const,
              label: `Commands & Concepts (${topicsWithCommands.length})`,
              icon: Terminal,
            },
            {
              id: "questions" as const,
              label: `Questions to Revisit (${topicsWithQuestions.length})`,
              icon: HelpCircle,
            },
            {
              id: "reflections" as const,
              label: `Reflections (${filteredReflections.length})`,
              icon: FileText,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer ${
                  tab === item.id
                    ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-300"
                    : "border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-[#0e1525] dark:text-slate-400"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            aria-label="Search notes"
            placeholder="Filter notes & commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Tab Content */}
      {tab === "topics" ? (
        topicsWithNotes.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-500">
            No topic notes saved yet. Use the Quick Note Editor above or open any
            topic from the Roadmap Explorer.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topicsWithNotes.map((t) => (
              <Card key={t.id} className="p-5">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                  <div>
                    <Link
                      href={`/roadmap/${t.id}`}
                      className="text-sm font-bold text-slate-900 hover:text-emerald-500 dark:text-white"
                    >
                      {t.title}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      {phaseMap.get(t.phaseId) || t.phaseId}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <MarkdownPreview content={t.notes} />
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "commands" ? (
        topicsWithCommands.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-500">
            No CLI commands or payloads recorded yet. Add them inside any Topic
            Detail page.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topicsWithCommands.map((t) => (
              <Card key={t.id} className="p-5">
                <Link
                  href={`/roadmap/${t.id}`}
                  className="text-sm font-bold text-slate-900 hover:text-emerald-500 dark:text-white"
                >
                  {t.title}
                </Link>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                  <code>{t.commandsLearned}</code>
                </pre>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "questions" ? (
        topicsWithQuestions.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-500">
            No open questions flagged for review yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topicsWithQuestions.map((t) => (
              <Card key={t.id} className="p-5">
                <Link
                  href={`/roadmap/${t.id}`}
                  className="text-sm font-bold text-slate-900 hover:text-emerald-500 dark:text-white"
                >
                  {t.title}
                </Link>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {t.questionsToRevisit}
                </p>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "reflections" ? (
        filteredReflections.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-500">
            No daily, weekly, or monthly reflections recorded yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReflections.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                    {r.periodType} · {r.periodKey}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Updated {r.updatedAt.slice(0, 10)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                  {r.learned ? (
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Learned:
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                        {r.learned}
                      </p>
                    </div>
                  ) : null}
                  {r.achievements ? (
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Practiced / Achievements:
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                        {r.achievements}
                      </p>
                    </div>
                  ) : null}
                  {r.challenges ? (
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Difficulties:
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                        {r.challenges}
                      </p>
                    </div>
                  ) : null}
                  {r.nextPriorities ? (
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Next Priorities:
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                        {r.nextPriorities}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
