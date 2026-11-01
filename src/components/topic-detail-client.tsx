"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Clock,
  ExternalLink,
  History,
  Plus,
  RotateCcw,
  Save,
  Square,
  Terminal,
} from "lucide-react";
import { formatMinutesHuman } from "@/lib/dates";
import {
  RESOURCE_TYPES,
  TOPIC_STATUSES,
  type CompletionEvent,
  type ResourceLink,
  type ResourceType,
  type StudySession,
  type Topic,
  type TopicStatus,
} from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { StudySessionModal } from "./session-modal";
import {
  Button,
  Card,
  DifficultyBadge,
  MarkdownPreview,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
} from "./ui/primitives";

export function TopicDetailClient({
  csrfToken,
  todayKey,
  initialTopic,
  initialSubtopics,
  allTopics,
  phaseTitle,
  sectionTitle,
  initialSessions,
  initialEvents,
}: {
  csrfToken: string;
  todayKey: string;
  initialTopic: Topic;
  initialSubtopics: Topic[];
  allTopics: Topic[];
  phaseTitle: string;
  sectionTitle: string;
  initialSessions: StudySession[];
  initialEvents: CompletionEvent[];
}) {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [subtopics, setSubtopics] = useState<Topic[]>(initialSubtopics);
  const [notesTab, setNotesTab] = useState<"edit" | "preview">("edit");

  const [notes, setNotes] = useState(initialTopic.notes);
  const [commandsLearned, setCommandsLearned] = useState(
    initialTopic.commandsLearned
  );
  const [questionsToRevisit, setQuestionsToRevisit] = useState(
    initialTopic.questionsToRevisit
  );
  const [nextAction, setNextAction] = useState(initialTopic.nextAction);
  const [confidence, setConfidence] = useState(initialTopic.confidence);
  const [plannedDate, setPlannedDate] = useState(initialTopic.plannedDate || "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    String(initialTopic.estimatedMinutes)
  );

  // Add Resource state
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resType, setResType] = useState<ResourceType>("documentation");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  const totalStudiedMinutes = initialSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  const patchTopic = async (
    payload: Record<string, unknown>,
    feedback?: string
  ) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await apiFetch<{
        topic: Topic;
        completionEvent: CompletionEvent | null;
      }>(`/api/topics/${topic.id}`, {
        method: "PATCH",
        csrfToken,
        body: JSON.stringify(payload),
      });
      setTopic(res.topic);
      if (feedback) setSaveMessage(feedback);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update topic.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: TopicStatus) => {
    await patchTopic({ status: newStatus }, `Status updated to ${newStatus}`);
  };

  const handleReopenForRevision = async () => {
    await patchTopic(
      { reopenForRevision: true },
      "Reopened for revision — prior completion history preserved."
    );
  };

  const toggleObjective = async (item: string) => {
    const exists = topic.completedObjectives.includes(item);
    const next = exists
      ? topic.completedObjectives.filter((x) => x !== item)
      : [...topic.completedObjectives, item];
    await patchTopic({ completedObjectives: next });
  };

  const toggleExercise = async (item: string) => {
    const exists = topic.completedExercises.includes(item);
    const next = exists
      ? topic.completedExercises.filter((x) => x !== item)
      : [...topic.completedExercises, item];
    await patchTopic({ completedExercises: next });
  };

  const toggleSubtopic = async (sub: Topic) => {
    const nextStatus: TopicStatus =
      sub.status === "Completed" ? "In Progress" : "Completed";
    try {
      const res = await apiFetch<{ topic: Topic }>(`/api/topics/${sub.id}`, {
        method: "PATCH",
        csrfToken,
        body: JSON.stringify({ status: nextStatus }),
      });
      setSubtopics((prev) =>
        prev.map((s) => (s.id === sub.id ? res.topic : s))
      );
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update subtopic.");
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) return;
    const newRes: ResourceLink = {
      title: resTitle.trim(),
      url: resUrl.trim(),
      type: resType,
    };
    await patchTopic(
      { resourceLinks: [...topic.resourceLinks, newRes] },
      "Resource added"
    );
    setResTitle("");
    setResUrl("");
  };

  const handleSaveNotesAndMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    await patchTopic(
      {
        notes,
        commandsLearned,
        questionsToRevisit,
        nextAction: nextAction.trim(),
        confidence,
        plannedDate: plannedDate.trim() || null,
        estimatedMinutes: Math.max(5, Number(estimatedMinutes) || 60),
      },
      "Topic notes & study plan saved."
    );
  };

  const completedSubs = subtopics.filter((s) => s.status === "Completed").length;
  const subPct =
    subtopics.length === 0
      ? 0
      : Math.round((completedSubs / subtopics.length) * 100);

  const prereqTopics = topic.prerequisites
    .map((pid) => allTopics.find((t) => t.id === pid))
    .filter(Boolean) as Topic[];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-500 dark:text-slate-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Roadmap Explorer
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {phaseTitle} · {sectionTitle}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {topic.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Topic status"
            value={topic.status}
            disabled={saving}
            onChange={(e) => handleStatusChange(e.target.value as TopicStatus)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {TOPIC_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {topic.status === "Completed" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopenForRevision}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
              <span>Reopen for Revision</span>
            </Button>
          ) : null}

          <Button size="sm" onClick={() => setSessionModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span>Log Study Session</span>
          </Button>
        </div>
      </div>

      {saveMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          {saveMessage}
        </div>
      ) : null}

      {/* Overview Card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={topic.status} />
          <PriorityBadge priority={topic.priority} />
          <DifficultyBadge difficulty={topic.difficulty} />
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Est. {topic.estimatedDuration} (
            {formatMinutesHuman(topic.estimatedMinutes)})
          </span>
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
            Logged: {formatMinutesHuman(totalStudiedMinutes)} across{" "}
            {initialSessions.length} session(s)
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {topic.description}
        </p>

        {topic.tools.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Tools:</span>
            {topic.tools.map((tool) => (
              <span
                key={tool}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {tool}
              </span>
            ))}
          </div>
        ) : null}

        {prereqTopics.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">
              Prerequisites:
            </span>
            {prereqTopics.map((pre) => (
              <Link
                key={pre.id}
                href={`/roadmap/${pre.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:border-emerald-500/40 dark:border-slate-800"
              >
                <span>{pre.title}</span>
                <StatusBadge status={pre.status} />
              </Link>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Subtopics, Objectives & Practical Exercises */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Subtopics / Milestones */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Subtopics &amp; Learning Objectives
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtopics.length > 0
                  ? `${completedSubs}/${subtopics.length} subtopics completed (${subPct}%)`
                  : `${topic.completedObjectives.length}/${topic.learningObjectives.length} objectives checked`}
              </p>
            </div>
          </div>

          {subtopics.length > 0 ? (
            <>
              <ProgressBar value={subPct} className="mb-4" />
              <div className="space-y-2">
                {subtopics.map((sub) => {
                  const done = sub.status === "Completed";
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSubtopic(sub)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-left text-xs hover:border-emerald-500/40 dark:border-slate-800 cursor-pointer"
                    >
                      {done ? (
                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span
                        className={
                          done
                            ? "line-through text-slate-400"
                            : "text-slate-800 dark:text-slate-200"
                        }
                      >
                        {sub.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {topic.learningObjectives.map((obj) => {
                const done = topic.completedObjectives.includes(obj);
                return (
                  <button
                    key={obj}
                    type="button"
                    onClick={() => toggleObjective(obj)}
                    className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-left text-xs dark:border-slate-800 cursor-pointer"
                  >
                    {done ? (
                      <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className={done ? "line-through text-slate-400" : ""}>
                      {obj}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Practical Exercises & Resources */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Practical Exercises &amp; Labs
            </h2>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Hands-on validation tasks from the roadmap
            </p>
            {topic.practicalExercises.length === 0 ? (
              <p className="text-xs text-slate-500">
                No specific exercises listed for this node.
              </p>
            ) : (
              <div className="space-y-2">
                {topic.practicalExercises.map((ex) => {
                  const done = topic.completedExercises.includes(ex);
                  return (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => toggleExercise(ex)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-left text-xs hover:border-emerald-500/40 dark:border-slate-800 cursor-pointer"
                    >
                      {done ? (
                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span
                        className={
                          done
                            ? "line-through text-slate-400"
                            : "text-slate-800 dark:text-slate-200"
                        }
                      >
                        {ex}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Learning Resources ({topic.resourceLinks.length})
              </h2>
            </div>

            <div className="space-y-2">
              {topic.resourceLinks.map((res, idx) => (
                <a
                  key={`${res.url}-${idx}`}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-2.5 text-xs hover:border-emerald-500/40 dark:border-slate-800"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {res.title}
                    </p>
                    {res.note ? (
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {res.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {res.type}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </a>
              ))}
            </div>

            <form
              onSubmit={handleAddResource}
              className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-4 dark:border-slate-800"
            >
              <input
                type="text"
                placeholder="Resource title"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <input
                type="url"
                placeholder="https://..."
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <select
                value={resType}
                onChange={(e) => setResType(e.target.value as ResourceType)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {RESOURCE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Add Link
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Study Plan, Markdown Notes, Commands Learned & Questions to Revisit */}
      <Card className="p-5">
        <form onSubmit={handleSaveNotesAndMeta} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Study Notes, Commands &amp; Self-Assessment
            </h2>
            <Button type="submit" size="sm" disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : "Save Notes & Plan"}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label
                htmlFor="detail-confidence"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Self-Assessed Confidence
              </label>
              <select
                id="detail-confidence"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value={0}>0 — Unrated</option>
                <option value={1}>1 — Novice</option>
                <option value={2}>2 — Developing</option>
                <option value={3}>3 — Competent</option>
                <option value={4}>4 — Strong</option>
                <option value={5}>5 — Mastered</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="detail-planned"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Target / Planned Date
              </label>
              <input
                id="detail-planned"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="detail-est-mins"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Estimated Minutes
              </label>
              <input
                id="detail-est-mins"
                type="number"
                min={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="detail-next-action"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Next Concrete Action
              </label>
              <input
                id="detail-next-action"
                type="text"
                placeholder="e.g., Finish Bandit Level 15-20"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Markdown Notes with Edit/Preview */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="detail-notes"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Topic Notes (Markdown supported)
              </label>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNotesTab("edit")}
                  className={`rounded-md px-2.5 py-1 cursor-pointer ${
                    notesTab === "edit"
                      ? "bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setNotesTab("preview")}
                  className={`rounded-md px-2.5 py-1 cursor-pointer ${
                    notesTab === "preview"
                      ? "bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {notesTab === "edit" ? (
              <textarea
                id="detail-notes"
                rows={6}
                placeholder="# Key Concepts&#10;- Write Markdown summaries, architecture notes, and lab walkthroughs..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-900"
              />
            ) : (
              <div className="min-h-[140px] rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <MarkdownPreview content={notes} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="detail-commands"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <Terminal className="h-3.5 w-3.5 text-emerald-500" />
                Commands, Payloads &amp; Concepts Learned
              </label>
              <textarea
                id="detail-commands"
                rows={4}
                placeholder="nmap -sC -sV -oA scan 10.10.11.24&#10;tcpdump -i tun0 -w capture.pcap"
                value={commandsLearned}
                onChange={(e) => setCommandsLearned(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="detail-questions"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Questions to Revisit / Knowledge Gaps
              </label>
              <textarea
                id="detail-questions"
                rows={4}
                placeholder="- How does Kerberoasting differ from AS-REP Roasting?&#10;- Re-test Linux capabilities privilege escalation"
                value={questionsToRevisit}
                onChange={(e) => setQuestionsToRevisit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </form>
      </Card>

      {/* Study Sessions & Separate Completion History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recorded Study Sessions ({initialSessions.length})
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSessionModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add Session
            </Button>
          </div>

          {initialSessions.length === 0 ? (
            <p className="text-xs text-slate-500">
              No study sessions logged against this topic yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {initialSessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {s.dateKey} {s.startedAt ? `at ${s.startedAt}` : ""} ·{" "}
                      {s.activityType}
                    </span>
                    <span className="font-mono font-semibold text-emerald-500">
                      {formatMinutesHuman(s.durationMinutes)}
                    </span>
                  </div>
                  {s.outcome ? (
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      Outcome: {s.outcome}
                    </p>
                  ) : null}
                  {s.notes ? (
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {s.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Completion &amp; Status History ({initialEvents.length})
            </h2>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Persisted separately from current status so reopening a topic for
            revision never erases earlier completions.
          </p>

          {initialEvents.length === 0 ? (
            <p className="text-xs text-slate-500">
              No status transitions recorded for this topic yet.
            </p>
          ) : (
            <div className="space-y-2">
              {initialEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                >
                  <div>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {ev.previousStatus ?? "None"} → {ev.newStatus}
                    </span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800">
                      {ev.eventType}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {ev.occurredAt.slice(0, 16).replace("T", " ")} UTC
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <StudySessionModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        csrfToken={csrfToken}
        topics={allTopics}
        defaultDateKey={todayKey}
        defaultTopicId={topic.id}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
