"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { calculateTopicSubtopicProgress } from "@/lib/analytics";
import {
  TOPIC_DIFFICULTIES,
  TOPIC_PRIORITIES,
  TOPIC_STATUSES,
  type RoadmapPhase,
  type RoadmapSection,
  type Topic,
  type TopicDifficulty,
  type TopicPriority,
  type TopicStatus,
} from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import {
  Button,
  Card,
  Dialog,
  DifficultyBadge,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
} from "./ui/primitives";

export function RoadmapClient({
  csrfToken,
  phases,
  sections,
  initialTopics,
  sourceUrl,
  lastReviewedAt,
}: {
  csrfToken: string;
  phases: RoadmapPhase[];
  sections: RoadmapSection[];
  initialTopics: Topic[];
  sourceUrl: string;
  lastReviewedAt: string;
}) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [expandedSubtopics, setExpandedSubtopics] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create / Edit Topic Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPhaseId, setFormPhaseId] = useState(phases[0]?.id || "");
  const [formSectionId, setFormSectionId] = useState(sections[0]?.id || "");
  const [formParentId, setFormParentId] = useState<string>("");
  const [formPriority, setFormPriority] = useState<TopicPriority>("Recommended");
  const [formDifficulty, setFormDifficulty] = useState<TopicDifficulty>("Intermediate");
  const [formDuration, setFormDuration] = useState("1–2 weeks");
  const [formMinutes, setFormMinutes] = useState("300");
  const [formPlannedDate, setFormPlannedDate] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<{
    subtopics: number;
    sessions: number;
    events: number;
  } | null>(null);
  const [purgeAssociated, setPurgeAssociated] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const primaryTopics = useMemo(
    () => topics.filter((t) => t.parentTopicId === null),
    [topics]
  );

  const filteredPrimary = useMemo(() => {
    const q = search.trim().toLowerCase();
    return primaryTopics.filter((t) => {
      if (phaseFilter !== "all" && t.phaseId !== phaseFilter) return false;
      if (sectionFilter !== "all" && t.sectionId !== sectionFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (difficultyFilter !== "all" && t.difficulty !== difficultyFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (q) {
        const subs = topics.filter((s) => s.parentTopicId === t.id);
        const matchesSelf =
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tools.some((tool) => tool.toLowerCase().includes(q));
        const matchesSub = subs.some((s) => s.title.toLowerCase().includes(q));
        if (!matchesSelf && !matchesSub) return false;
      }
      return true;
    });
  }, [
    primaryTopics,
    topics,
    search,
    phaseFilter,
    sectionFilter,
    statusFilter,
    difficultyFilter,
    priorityFilter,
  ]);

  const handleStatusChange = async (topicId: string, newStatus: TopicStatus) => {
    if (updatingId === topicId) return;
    setUpdatingId(topicId);
    try {
      const res = await apiFetch<{ topic: Topic }>(`/api/topics/${topicId}`, {
        method: "PATCH",
        csrfToken,
        body: JSON.stringify({ status: newStatus }),
      });
      setTopics((prev) => prev.map((t) => (t.id === topicId ? res.topic : t)));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreateModal = (defaults?: {
    phaseId?: string;
    sectionId?: string;
    parentTopicId?: string;
  }) => {
    setEditingTopic(null);
    const pId = defaults?.phaseId || phases[0]?.id || "";
    const firstSec =
      defaults?.sectionId ||
      sections.find((s) => s.phaseId === pId)?.id ||
      sections[0]?.id ||
      "";
    setFormTitle("");
    setFormDesc("");
    setFormPhaseId(pId);
    setFormSectionId(firstSec);
    setFormParentId(defaults?.parentTopicId || "");
    setFormPriority("Recommended");
    setFormDifficulty("Intermediate");
    setFormDuration(defaults?.parentTopicId ? "2 hrs" : "1–2 weeks");
    setFormMinutes(defaults?.parentTopicId ? "120" : "600");
    setFormPlannedDate("");
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (topic: Topic) => {
    setEditingTopic(topic);
    setFormTitle(topic.title);
    setFormDesc(topic.description);
    setFormPhaseId(topic.phaseId);
    setFormSectionId(topic.sectionId);
    setFormParentId(topic.parentTopicId || "");
    setFormPriority(topic.priority);
    setFormDifficulty(topic.difficulty);
    setFormDuration(topic.estimatedDuration);
    setFormMinutes(String(topic.estimatedMinutes));
    setFormPlannedDate(topic.plannedDate || "");
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return;
    setFormSaving(true);
    setFormError(null);

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        phaseId: formPhaseId,
        sectionId: formSectionId,
        parentTopicId: formParentId || null,
        priority: formPriority,
        difficulty: formDifficulty,
        estimatedDuration: formDuration.trim() || "1 week",
        estimatedMinutes: Math.max(5, Number(formMinutes) || 120),
        plannedDate: formPlannedDate.trim() || null,
      };

      if (editingTopic) {
        const res = await apiFetch<{ topic: Topic }>(
          `/api/topics/${editingTopic.id}`,
          {
            method: "PATCH",
            csrfToken,
            body: JSON.stringify(payload),
          }
        );
        setTopics((prev) =>
          prev.map((t) => (t.id === editingTopic.id ? res.topic : t))
        );
      } else {
        const res = await apiFetch<{ topic: Topic }>("/api/topics", {
          method: "POST",
          csrfToken,
          body: JSON.stringify(payload),
        });
        setTopics((prev) => [...prev, res.topic]);
      }

      setEditorOpen(false);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save topic.");
    } finally {
      setFormSaving(false);
    }
  };

  const requestDeleteTopic = async (topic: Topic) => {
    setDeleteTarget(topic);
    setDeleteImpact(null);
    setPurgeAssociated(false);
    try {
      const res = await apiFetch<{
        impact: { subtopics: number; sessions: number; events: number };
      }>(`/api/topics/${topic.id}`);
      setDeleteImpact(res.impact);
    } catch {
      setDeleteImpact({ subtopics: 0, sessions: 0, events: 0 });
    }
  };

  const confirmDeleteTopic = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiFetch(
        `/api/topics/${deleteTarget.id}?deleteRecords=${purgeAssociated}`,
        {
          method: "DELETE",
          csrfToken,
        }
      );
      setTopics((prev) =>
        prev.filter(
          (t) => t.id !== deleteTarget.id && t.parentTopicId !== deleteTarget.id
        )
      );
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete topic.");
    } finally {
      setDeleting(false);
    }
  };

  const selectCls =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  const availableSections =
    phaseFilter === "all"
      ? sections
      : sections.filter((s) => s.phaseId === phaseFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cybersecurity Learning Roadmap
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Source:{" "}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {sourceUrl} <ExternalLink className="h-3 w-3" />
            </a>{" "}
            · Last reviewed: <span className="font-mono">{lastReviewedAt}</span>
          </p>
        </div>

        <Button onClick={() => openCreateModal()}>
          <Plus className="h-4 w-4" />
          <span>Add Custom Topic</span>
        </Button>
      </div>

      {/* Search & 5 Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Search topics, tools, or subtopics"
              placeholder="Search topics, subtopics, tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            aria-label="Filter by Phase"
            value={phaseFilter}
            onChange={(e) => {
              setPhaseFilter(e.target.value);
              setSectionFilter("all");
            }}
            className={selectCls}
          >
            <option value="all">All Phases (5)</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Section"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All Sections ({availableSections.length})</option>
            {availableSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number}. {s.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All Statuses</option>
            {TOPIC_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Filter by Difficulty"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">Difficulty</option>
              {TOPIC_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">Priority</option>
              {TOPIC_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Expandable Phases -> Sections -> Topics -> Subtopics */}
      {filteredPrimary.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No topics match your active search or filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setSearch("");
              setPhaseFilter("all");
              setSectionFilter("all");
              setStatusFilter("all");
              setDifficultyFilter("all");
              setPriorityFilter("all");
            }}
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          {phases.map((phase) => {
            const phaseTopics = filteredPrimary.filter(
              (t) => t.phaseId === phase.id
            );
            if (phaseTopics.length === 0) return null;

            const allPhasePrimary = primaryTopics.filter(
              (t) => t.phaseId === phase.id
            );
            const phaseCompleted = allPhasePrimary.filter(
              (t) => t.status === "Completed"
            ).length;
            const phasePercent =
              allPhasePrimary.length === 0
                ? 0
                : Math.round((phaseCompleted / allPhasePrimary.length) * 100);

            const isCollapsed = Boolean(collapsedPhases[phase.id]);
            const phaseSections = sections.filter((s) => s.phaseId === phase.id);

            return (
              <Card key={phase.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedPhases((prev) => ({
                      ...prev,
                      [phase.id]: !prev[phase.id],
                    }))
                  }
                  className="flex w-full items-center justify-between gap-4 bg-slate-100/70 px-5 py-4 text-left hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-900 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-emerald-500" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          {phase.title}
                        </h2>
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {phase.estimatedDuration}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {phase.description}
                      </p>
                    </div>
                  </div>

                  <div className="hidden w-44 shrink-0 sm:block">
                    <div className="mb-1 flex justify-between font-mono text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        {phaseCompleted}/{allPhasePrimary.length}
                      </span>
                      <span>{phasePercent}%</span>
                    </div>
                    <ProgressBar value={phasePercent} />
                  </div>
                </button>

                {!isCollapsed ? (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {phaseSections.map((sec) => {
                      const secTopics = phaseTopics.filter(
                        (t) => t.sectionId === sec.id
                      );
                      if (secTopics.length === 0) return null;

                      return (
                        <div key={sec.id} className="p-5">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Section {sec.number}: {sec.title}
                            </h3>
                            <button
                              type="button"
                              onClick={() =>
                                openCreateModal({
                                  phaseId: phase.id,
                                  sectionId: sec.id,
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-500 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Topic
                            </button>
                          </div>

                          <div className="space-y-3">
                            {secTopics.map((topic) => {
                              const subProgress = calculateTopicSubtopicProgress(
                                topic.id,
                                topics
                              );
                              const subtopics = topics.filter(
                                (s) => s.parentTopicId === topic.id
                              );
                              const subsOpen = Boolean(expandedSubtopics[topic.id]);

                              return (
                                <div
                                  key={topic.id}
                                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-500/35 dark:border-slate-800 dark:bg-[#0b111e]"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                          href={`/roadmap/${topic.id}`}
                                          className="text-base font-semibold text-slate-900 hover:text-emerald-500 dark:text-slate-100"
                                        >
                                          {topic.title}
                                        </Link>
                                        <StatusBadge status={topic.status} />
                                        <PriorityBadge priority={topic.priority} />
                                        <DifficultyBadge
                                          difficulty={topic.difficulty}
                                        />
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                          <Clock className="h-3 w-3" />
                                          {topic.estimatedDuration}
                                        </span>
                                      </div>

                                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                        {topic.description}
                                      </p>

                                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {subProgress.total > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedSubtopics((prev) => ({
                                                ...prev,
                                                [topic.id]: !prev[topic.id],
                                              }))
                                            }
                                            className="inline-flex items-center gap-1.5 font-medium text-emerald-600 hover:underline dark:text-emerald-400 cursor-pointer"
                                          >
                                            {subsOpen ? (
                                              <ChevronDown className="h-3.5 w-3.5" />
                                            ) : (
                                              <ChevronRight className="h-3.5 w-3.5" />
                                            )}
                                            <span>
                                              {subProgress.completed}/
                                              {subProgress.total} subtopics (
                                              {subProgress.percentage}%)
                                            </span>
                                          </button>
                                        ) : null}

                                        <span className="inline-flex items-center gap-1">
                                          <BookOpen className="h-3.5 w-3.5" />
                                          {topic.resourceLinks.length} resources
                                        </span>

                                        <Link
                                          href={`/roadmap/${topic.id}`}
                                          className="font-medium text-slate-700 hover:text-emerald-500 dark:text-slate-300"
                                        >
                                          Open Details →
                                        </Link>
                                      </div>
                                    </div>

                                    {/* Quick Inline Status & CRUD Actions */}
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                      <select
                                        aria-label={`Status for ${topic.title}`}
                                        value={topic.status}
                                        disabled={updatingId === topic.id}
                                        onChange={(e) =>
                                          handleStatusChange(
                                            topic.id,
                                            e.target.value as TopicStatus
                                          )
                                        }
                                        className={selectCls}
                                      >
                                        {TOPIC_STATUSES.map((st) => (
                                          <option key={st} value={st}>
                                            {st}
                                          </option>
                                        ))}
                                      </select>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          openCreateModal({
                                            phaseId: topic.phaseId,
                                            sectionId: topic.sectionId,
                                            parentTopicId: topic.id,
                                          })
                                        }
                                        title="Add subtopic"
                                        aria-label={`Add subtopic to ${topic.title}`}
                                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:border-slate-800 dark:hover:bg-slate-800 cursor-pointer"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => openEditModal(topic)}
                                        title="Edit topic"
                                        aria-label={`Edit ${topic.title}`}
                                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => requestDeleteTopic(topic)}
                                        title="Delete topic"
                                        aria-label={`Delete ${topic.title}`}
                                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {subProgress.total > 0 ? (
                                    <ProgressBar
                                      value={subProgress.percentage}
                                      className="mt-3 h-1.5"
                                    />
                                  ) : null}

                                  {/* Expandable Subtopics List */}
                                  {subsOpen && subtopics.length > 0 ? (
                                    <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 dark:border-slate-800">
                                      {subtopics.map((sub) => {
                                        const done = sub.status === "Completed";
                                        return (
                                          <div
                                            key={sub.id}
                                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900/70"
                                          >
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleStatusChange(
                                                  sub.id,
                                                  done ? "In Progress" : "Completed"
                                                )
                                              }
                                              disabled={updatingId === sub.id}
                                              className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                                            >
                                              {done ? (
                                                <CheckSquare className="h-4 w-4 shrink-0 text-emerald-500" />
                                              ) : (
                                                <Square className="h-4 w-4 shrink-0 text-slate-400" />
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

                                            <div className="flex items-center gap-2">
                                              <StatusBadge status={sub.status} />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  requestDeleteTopic(sub)
                                                }
                                                aria-label={`Delete subtopic ${sub.title}`}
                                                className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Topic Modal */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={
          editingTopic
            ? `Edit ${editingTopic.parentTopicId ? "Subtopic" : "Topic"}`
            : formParentId
              ? "Add Subtopic"
              : "Add Custom Topic"
        }
        description="Customize your cybersecurity learning curriculum."
      >
        <form onSubmit={handleSaveTopic} className="space-y-3.5">
          {formError ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-500">
              {formError}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="topic-title"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Title
            </label>
            <input
              id="topic-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              required
            />
          </div>

          <div>
            <label
              htmlFor="topic-desc"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Description
            </label>
            <textarea
              id="topic-desc"
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="topic-phase"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Phase
              </label>
              <select
                id="topic-phase"
                value={formPhaseId}
                onChange={(e) => {
                  const nextP = e.target.value;
                  setFormPhaseId(nextP);
                  const firstSec = sections.find((s) => s.phaseId === nextP);
                  if (firstSec) setFormSectionId(firstSec.id);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="topic-section"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Section
              </label>
              <select
                id="topic-section"
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {sections
                  .filter((s) => s.phaseId === formPhaseId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}. {s.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="topic-priority"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Priority
              </label>
              <select
                id="topic-priority"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as TopicPriority)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {TOPIC_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="topic-difficulty"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Difficulty
              </label>
              <select
                id="topic-difficulty"
                value={formDifficulty}
                onChange={(e) =>
                  setFormDifficulty(e.target.value as TopicDifficulty)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {TOPIC_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="topic-duration-label"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Duration Label
              </label>
              <input
                id="topic-duration-label"
                type="text"
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="topic-est-mins"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Est. Minutes
              </label>
              <input
                id="topic-est-mins"
                type="number"
                min={5}
                value={formMinutes}
                onChange={(e) => setFormMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="topic-planned"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Planned Date
              </label>
              <input
                id="topic-planned"
                type="date"
                value={formPlannedDate}
                onChange={(e) => setFormPlannedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formSaving}>
              {formSaving ? "Saving..." : editingTopic ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Pre-Delete Confirmation Dialog with Impact Explanation */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Topic Deletion"
        description="Review what happens to associated learning records before deleting."
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Deleting &ldquo;{deleteTarget.title}&rdquo;
                </p>
                {deleteImpact ? (
                  <p>
                    This item currently has{" "}
                    <strong>{deleteImpact.subtopics} subtopic(s)</strong>,{" "}
                    <strong>{deleteImpact.sessions} study session(s)</strong>, and{" "}
                    <strong>
                      {deleteImpact.events} completion-history event(s)
                    </strong>
                    .
                  </p>
                ) : (
                  <p>Checking associated records...</p>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={purgeAssociated}
                onChange={(e) => setPurgeAssociated(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-slate-700 dark:text-slate-300">
                <strong>Also delete associated study sessions &amp; completion events.</strong>{" "}
                Leave unchecked to preserve your historical study-time minutes and
                streaks while removing only the topic &amp; its subtopics.
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleting}
                onClick={confirmDeleteTopic}
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
