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
  return (
    <section>
      <SectionHeader
        title="Tasks"
        action={
          <AddTaskButton
            onAdd={async (title) => {
              await api.post(`/api/events/${event.id}/tasks`, { title });
              reload();
            }}
          />
        }
      />
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

function AddTaskButton({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open)
    return (
      <Button size="sm" variant="subtle" onClick={() => setOpen(true)}>
        + Add task
      </Button>
    );
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="h-8 w-40 rounded border border-base bg-surface px-2 text-sm text-ink"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            onAdd(title.trim());
            setTitle("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button
        className="text-sm text-brand-600"
        onClick={() => {
          if (title.trim()) {
            onAdd(title.trim());
            setTitle("");
            setOpen(false);
          }
        }}
      >
        Add
      </button>
    </div>
  );
}
