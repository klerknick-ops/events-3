"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Task } from "@/lib/types";
import { Button, Card, EmptyState, Spinner } from "@/components/ui";
import { EVENT_STATUS_STYLES } from "@/lib/enums";
import clsx from "clsx";

type Filter = "open" | "done" | "all";

interface Bucket {
  key: string;
  label: string;
  tone: string;
  tasks: Task[];
}

function bucketFor(due: Date | null, now: Date): string {
  if (!due) return "nodue";
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - startToday.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "later";
}

const BUCKET_META: Record<string, { label: string; tone: string; order: number }> = {
  overdue: { label: "Overdue", tone: "text-rose-700", order: 0 },
  today: { label: "Due today", tone: "text-amber-700", order: 1 },
  week: { label: "Next 7 days", tone: "text-brand-700 dark:text-brand-300", order: 2 },
  later: { label: "Later", tone: "text-ink-soft", order: 3 },
  nodue: { label: "No due date", tone: "text-ink-muted", order: 4 },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");

  async function load() {
    setLoading(true);
    setTasks(await api.get<Task[]>(`/api/tasks?status=${filter}`));
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const buckets: Bucket[] = useMemo(() => {
    const now = new Date();
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const b = bucketFor(t.dueDate ? new Date(t.dueDate) : null, now);
      const arr = map.get(b) ?? [];
      arr.push(t);
      map.set(b, arr);
    }
    return [...map.entries()]
      .map(([key, ts]) => ({
        key,
        label: BUCKET_META[key].label,
        tone: BUCKET_META[key].tone,
        tasks: ts,
      }))
      .sort((a, b) => BUCKET_META[a.key].order - BUCKET_META[b.key].order);
  }, [tasks]);

  async function toggle(t: Task) {
    await api.patch(`/api/tasks/${t.id}`, { completed: !t.completed });
    load();
  }

  const openCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Tasks & deadlines</h1>
          <p className="text-sm text-ink-muted">
            Upcoming work across every event.
            {filter === "open" ? ` ${openCount} open.` : ""}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-base bg-surface p-0.5">
          {(["open", "done", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                filter === f
                  ? "bg-brand-600 text-white"
                  : "text-ink-muted hover:bg-surface-2",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Nothing here"
          description={
            filter === "open"
              ? "No open tasks. You’re all caught up!"
              : "No tasks match this filter."
          }
        />
      ) : (
        <div className="space-y-6">
          {buckets.map((b) => (
            <div key={b.key}>
              <h2 className={clsx("mb-2 text-sm font-semibold", b.tone)}>
                {b.label}{" "}
                <span className="font-normal text-ink-muted">
                  ({b.tasks.length})
                </span>
              </h2>
              <Card className="divide-y divide-base">
                {b.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => toggle(t)}
                      className="h-4 w-4 rounded border-base"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={clsx(
                          "truncate text-sm",
                          t.completed
                            ? "text-ink-muted line-through"
                            : "text-ink",
                        )}
                      >
                        {t.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                        {t.event ? (
                          <>
                            <span
                              className={`h-2 w-2 rounded-full ${EVENT_STATUS_STYLES[t.event.status].dot}`}
                            />
                            <span className="truncate">{t.event.title}</span>
                            <span>·</span>
                            <span className="truncate">
                              {t.event.contact.company?.name ??
                                `${t.event.contact.firstName} ${t.event.contact.lastName}`}
                            </span>
                          </>
                        ) : null}
                        {t.assignee ? <span>· {t.assignee}</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-ink-muted">
                      {t.dueDate
                        ? new Date(t.dueDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
