"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import type { EventFull } from "@/lib/types";
import { Button } from "@/components/ui";
import { Empty, SectionHeader } from "../PanelBits";

export function TasksTab({
  event,
  reload,
}: {
  event: EventFull;
  reload: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <SectionHeader
        title="Tasks"
        action={
          !adding ? (
            <Button size="sm" variant="subtle" onClick={() => setAdding(true)}>
              + Add task
            </Button>
          ) : null
        }
      />
      {adding ? (
        <AddTaskForm
          onCancel={() => setAdding(false)}
          onAdd={async (input) => {
            await api.post(`/api/events/${event.id}/tasks`, input);
            setAdding(false);
            reload();
          }}
        />
      ) : null}
      {event.tasks.length === 0 ? (
        <Empty>No tasks. Add ad-hoc tasks or create from a template.</Empty>
      ) : (
        <div className="space-y-1.5">
          {event.tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-base px-3 py-2"
            >
              <input
                type="checkbox"
                checked={t.completed}
                onChange={async () => {
                  await api.patch(`/api/tasks/${t.id}`, { completed: !t.completed });
                  reload();
                }}
                className="h-4 w-4 rounded border-base"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={
                    "truncate text-sm " +
                    (t.completed ? "text-ink-muted line-through" : "text-ink")
                  }
                >
                  {t.title}
                </div>
                <div className="text-xs text-ink-muted">
                  {t.dueDate
                    ? `Due ${new Date(t.dueDate).toLocaleDateString()}`
                    : "No due date"}
                  {t.assignee ? ` · ${t.assignee}` : ""}
                </div>
              </div>
              <button
                className="text-ink-muted hover:text-rose-600"
                onClick={async () => {
                  await api.del(`/api/tasks/${t.id}`);
                  reload();
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Manual task creation — a deadline is required (Phase 3, Section 4).
function AddTaskForm({
  onAdd,
  onCancel,
}: {
  onAdd: (input: { title: string; dueDate: string; assignee: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return setError("A task title is required");
    if (!dueDate) return setError("A deadline is required");
    setSaving(true);
    setError(null);
    try {
      await onAdd({ title: title.trim(), dueDate, assignee: assignee.trim() || null });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-base bg-surface-2 p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="h-9 w-full rounded border border-base bg-surface px-2 text-sm text-ink"
      />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Deadline (required)
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-0.5 h-9 rounded border border-base bg-surface px-2 text-sm font-normal normal-case text-ink"
          />
        </label>
        <label className="flex flex-1 flex-col text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Assignee (optional)
          <input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="e.g. Coordinator"
            className="mt-0.5 h-9 rounded border border-base bg-surface px-2 text-sm font-normal normal-case text-ink"
          />
        </label>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? "Adding…" : "Add task"}
        </Button>
      </div>
    </div>
  );
}
