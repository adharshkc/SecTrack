"use client";

import React, { useEffect, useState } from "react";
import { ACTIVITY_TYPES, type ActivityType, type StudySession, type Topic } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { Button, Dialog } from "./ui/primitives";

export function StudySessionModal({
  open,
  onClose,
  csrfToken,
  topics,
  defaultDateKey,
  defaultTopicId,
  editingSession,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  csrfToken: string;
  topics: Topic[];
  defaultDateKey: string;
  defaultTopicId?: string;
  editingSession?: StudySession | null;
  onSaved: () => void;
}) {
  const selectableTopics = topics.filter((t) => t.isTrackable !== false);
  const firstSelectableId = selectableTopics[0]?.id || "";

  const [topicId, setTopicId] = useState(
    editingSession?.topicId || defaultTopicId || firstSelectableId
  );
  const [dateKey, setDateKey] = useState(editingSession?.dateKey || defaultDateKey);
  const [startedAt, setStartedAt] = useState(editingSession?.startedAt || "");
  const [durationMinutes, setDurationMinutes] = useState(
    String(editingSession?.durationMinutes || 60)
  );
  const [activityType, setActivityType] = useState<ActivityType>(
    editingSession?.activityType || "Lab"
  );
  const [outcome, setOutcome] = useState(editingSession?.outcome || "");
  const [notes, setNotes] = useState(editingSession?.notes || "");
  const [confidence, setConfidence] = useState(editingSession?.confidence || 3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTopicId(
      editingSession?.topicId || defaultTopicId || firstSelectableId
    );
    setDateKey(editingSession?.dateKey || defaultDateKey);
    setStartedAt(editingSession?.startedAt || "");
    setDurationMinutes(String(editingSession?.durationMinutes || 60));
    setActivityType(editingSession?.activityType || "Lab");
    setOutcome(editingSession?.outcome || "");
    setNotes(editingSession?.notes || "");
    setConfidence(editingSession?.confidence || 3);
    setError(null);
  }, [open, editingSession, defaultDateKey, defaultTopicId, firstSelectableId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const mins = Number(durationMinutes);
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
      setError("Duration must be between 1 and 1440 minutes.");
      return;
    }
    if (!topicId) {
      setError("Please select a learning topic.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        topicId,
        dateKey,
        startedAt: startedAt.trim() ? startedAt.trim() : null,
        durationMinutes: mins,
        activityType,
        outcome: outcome.trim(),
        notes: notes.trim(),
        confidence,
      };

      if (editingSession) {
        await apiFetch(`/api/sessions/${editingSession.id}`, {
          method: "PATCH",
          csrfToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/sessions", {
          method: "POST",
          csrfToken,
          body: JSON.stringify(payload),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save study session.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editingSession ? "Edit Study Session" : "Log Study Session"}
      description="Record focused cybersecurity study, practical lab work, CTF challenges, or revision."
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="session-topic"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Topic / Subtopic
          </label>
          <select
            id="session-topic"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className={inputCls}
            required
          >
            {selectableTopics
              .filter((t) => !t.parentTopicId)
              .map((parent) => {
                const subs = selectableTopics.filter(
                  (s) => s.parentTopicId === parent.id
                );
                return (
                  <optgroup key={parent.id} label={parent.title}>
                    <option value={parent.id}>{parent.title} (Primary Topic)</option>
                    {subs.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        ↳ {sub.title.slice(0, 80)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="session-date"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Date
            </label>
            <input
              id="session-date"
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label
              htmlFor="session-start"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Start Time (optional)
            </label>
            <input
              id="session-start"
              type="time"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="session-duration"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Duration (minutes)
            </label>
            <input
              id="session-duration"
              type="number"
              min={1}
              max={1440}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className={inputCls}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="session-activity"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Activity Type
            </label>
            <select
              id="session-activity"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              className={inputCls}
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="session-confidence"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Confidence Rating ({confidence}/5)
            </label>
            <select
              id="session-confidence"
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className={inputCls}
            >
              <option value={1}>1 — Struggled / Needs Review</option>
              <option value={2}>2 — Basic Familiarity</option>
              <option value={3}>3 — Solid Understanding</option>
              <option value={4}>4 — Confident in Practice</option>
              <option value={5}>5 — Can Explain & Apply Independently</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="session-outcome"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Outcome / Deliverable
          </label>
          <input
            id="session-outcome"
            type="text"
            placeholder="e.g., Completed TryHackMe Nmap room & captured 3 PCAP traces"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="session-notes"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Session Notes
          </label>
          <textarea
            id="session-notes"
            rows={3}
            placeholder="Key takeaways, commands used, flags, or blockers encountered..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving..."
              : editingSession
                ? "Update Session"
                : "Record Session"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
