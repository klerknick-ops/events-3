import type { TaskTemplate } from "@prisma/client";
import { addDays } from "./dates";

export interface GeneratedTask {
  title: string;
  assignee: string | null;
  dueDate: Date | null;
}

// Compute a concrete due date for a task-template rule.
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
  // BEFORE_EVENT
  if (!eventDate) return null;
  return addDays(eventDate, -rule.offsetDays);
}

export function generateTasksFromTemplates(
  taskTemplates: TaskTemplate[],
  eventDate: Date | null,
  creationDate: Date,
): GeneratedTask[] {
  return taskTemplates.map((t) => ({
    title: t.title,
    assignee: t.defaultAssignee ?? null,
    dueDate: dueDateFor(t, eventDate, creationDate),
  }));
}
