"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicDifficulty, TopicPriority, TopicStatus } from "@/lib/types";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xs dark:border-slate-800/90 dark:bg-[#0e1525] dark:text-slate-100",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500 shadow-xs",
    secondary:
      "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    outline:
      "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/70",
    ghost:
      "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-500",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs font-medium rounded-lg",
    md: "h-9 px-4 text-sm font-medium rounded-lg",
    lg: "h-11 px-5 text-sm font-semibold rounded-xl",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-emerald-500 transition-all duration-300",
          barClassName
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: TopicStatus }) {
  const styles: Record<TopicStatus, string> = {
    "Not Started":
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700",
    "In Progress":
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    Practiced:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
    Completed:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    "Needs Revision":
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TopicPriority }) {
  const styles: Record<TopicPriority, string> = {
    Essential:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25",
    Recommended:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/25",
    Optional:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        styles[priority]
      )}
    >
      {priority}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: TopicDifficulty }) {
  const styles: Record<TopicDifficulty, string> = {
    Beginner:
      "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60",
    Intermediate:
      "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/60",
    Advanced:
      "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60",
    Expert:
      "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/60",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        styles[difficulty]
      )}
    >
      {difficulty}
    </span>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0e1525]",
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2
              id="dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Safe, zero-XSS Markdown renderer supporting headings, code blocks, inline code,
 * bullet lists, bold text, and paragraphs using pure React elements (no dangerouslySetInnerHTML).
 */
export function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-sm italic text-slate-400 dark:text-slate-500">
        No notes written yet.
      </p>
    );
  }

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const renderInline = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={idx}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        blocks.push(
          <pre
            key={`code-${idx}`}
            className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-emerald-300 dark:border-slate-800"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h4
          key={idx}
          className="mt-3 mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h3
          key={idx}
          className="mt-4 mb-1.5 text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2
          key={idx}
          className="mt-4 mb-2 text-lg font-bold text-slate-900 dark:text-slate-100"
        >
          {renderInline(line.slice(2))}
        </h2>
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      blocks.push(
        <div
          key={idx}
          className="ml-3 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span>{renderInline(line.trim().slice(2))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={idx} className="h-2" />);
    } else {
      blocks.push(
        <p key={idx} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInline(line)}
        </p>
      );
    }
  });

  if (inCode && codeLines.length > 0) {
    blocks.push(
      <pre
        key="code-tail"
        className="my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}
