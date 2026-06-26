import type { TaskTemplate } from "@prisma/client";
import { addDays } from "./dates";

export interface GeneratedTask {
  title: string;
  assignee: string | null;
  assignedUserId: string | null;
  dueDate: Date | null;
}

// Compute a concrete due date for a date-relative task rule.
//  - BEFORE_EVENT:    eventDate - offsetDays
//  - BEFORE_CREATION: creationDate + offsetDays  (i.e. "X days after creation")
export function dueDateFor(
  rule: Pick<TaskTemplate, "offsetDays" | "basis">,
  eventDate: Date | null,
  creationDate: Date,
): Date | null {
  if (rule.basis === "BEFORE_CREATION") {
    return addDays(creationDate, rule.offsetDays);
  }
  if (!eventDate) return null;
  return addDays(eventDate, -rule.offsetDays);
}

// ----- Recurrence -----

function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): Date {
  if (ordinal === -1) {
    // last <weekday> of the month
    const last = new Date(year, month + 1, 0);
    const shift = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - shift);
  }
  const first = new Date(year, month, 1);
  const shift = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + shift + (ordinal - 1) * 7);
}

// Next occurrence of a recurring rule at/after `from`.
export function nextRecurrenceDate(
  rule: Pick<
    TaskTemplate,
    "recurrenceFreq" | "recurrenceWeekday" | "recurrenceDay" | "recurrenceOrdinal"
  >,
  from: Date,
): Date | null {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);

  if (rule.recurrenceFreq === "WEEKLY") {
    const wd = rule.recurrenceWeekday ?? 1;
    const shift = (wd - base.getDay() + 7) % 7;
    return addDays(base, shift);
  }

  if (rule.recurrenceFreq === "MONTHLY") {
    const y = base.getFullYear();
    const m = base.getMonth();
    // Ordinal weekday pattern (e.g. "2nd Monday").
    if (rule.recurrenceOrdinal != null && rule.recurrenceWeekday != null) {
      let d = nthWeekdayOfMonth(y, m, rule.recurrenceWeekday, rule.recurrenceOrdinal);
      if (d < base) d = nthWeekdayOfMonth(y, m + 1, rule.recurrenceWeekday, rule.recurrenceOrdinal);
      return d;
    }
    // Day-of-month pattern (e.g. "the 15th").
    const dom = rule.recurrenceDay ?? 1;
    let d = new Date(y, m, dom);
    if (d < base) d = new Date(y, m + 1, dom);
    return d;
  }

  return null;
}

// Build tasks to create when a template is applied to a new event. Date-relative
// rules use the event/creation dates; recurring rules generate their next
// occurrence. Action-triggered rules are skipped here — they fire later from the
// inbox / status-change hooks (see lib/task-rules.ts).
export function generateTasksFromTemplates(
  taskTemplates: TaskTemplate[],
  eventDate: Date | null,
  creationDate: Date,
): GeneratedTask[] {
  const out: GeneratedTask[] = [];
  for (const t of taskTemplates) {
    if (t.triggerType === "ACTION") continue;
    const dueDate =
      t.triggerType === "RECURRING"
        ? nextRecurrenceDate(t, creationDate)
        : dueDateFor(t, eventDate, creationDate);
    out.push({
      title: t.title,
      assignee: t.defaultAssignee ?? null,
      assignedUserId: t.assignedUserId ?? null,
      dueDate,
    });
  }
  return out;
}
