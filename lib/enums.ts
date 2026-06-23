// Enum-like values modeled as string unions (SQLite has no native enum type).

export const EVENT_STATUSES = [
  "INQUIRY",
  "TENTATIVE",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  INQUIRY: "Inquiry",
  TENTATIVE: "Tentative",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Tailwind-friendly classes for status pills + timeline blocks.
export const EVENT_STATUS_STYLES: Record<
  EventStatus,
  { pill: string; block: string; dot: string }
> = {
  INQUIRY: {
    pill: "bg-slate-100 text-slate-700 border-slate-200",
    block: "bg-slate-400/85 border-slate-500 text-white",
    dot: "bg-slate-400",
  },
  TENTATIVE: {
    pill: "bg-amber-100 text-amber-800 border-amber-200",
    block: "bg-amber-400/90 border-amber-500 text-amber-950",
    dot: "bg-amber-400",
  },
  CONFIRMED: {
    pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
    block: "bg-emerald-500/90 border-emerald-600 text-white",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    pill: "bg-sky-100 text-sky-800 border-sky-200",
    block: "bg-sky-500/85 border-sky-600 text-white",
    dot: "bg-sky-500",
  },
  CANCELLED: {
    pill: "bg-rose-100 text-rose-700 border-rose-200 line-through",
    block: "bg-rose-300/70 border-rose-400 text-rose-950 opacity-70",
    dot: "bg-rose-400",
  },
};

export const TASK_DEADLINE_BASES = ["BEFORE_EVENT", "BEFORE_CREATION"] as const;
export type TaskDeadlineBasis = (typeof TASK_DEADLINE_BASES)[number];

export const TASK_DEADLINE_BASIS_LABELS: Record<TaskDeadlineBasis, string> = {
  BEFORE_EVENT: "days before the event",
  BEFORE_CREATION: "days after creation",
};

export function isEventStatus(v: unknown): v is EventStatus {
  return typeof v === "string" && (EVENT_STATUSES as readonly string[]).includes(v);
}
