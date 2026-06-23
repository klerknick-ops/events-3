"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/fetcher";
import { formatTime, ymd } from "@/lib/dates";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
  type EventStatus,
} from "@/lib/enums";
import { Button, Card, EmptyState, Spinner } from "@/components/ui";
import { SidePanel } from "@/components/SidePanel";
import { EventDetailPanel } from "@/components/event/EventDetailPanel";
import { NewEventPanel } from "@/components/event/NewEventPanel";
import { useMe } from "@/components/MeProvider";

interface DashboardData {
  eventsToday: {
    id: string;
    title: string;
    status: string;
    client: string;
    company: string | null;
    spaces: string[];
    start: string;
    end: string;
  }[];
  counts: {
    eventsToday: number;
    tasksDueToday: number;
    tasksOverdue: number;
    tasksThisWeek: number;
    roomsTonight: number;
  };
  attention: {
    id: string;
    title: string;
    dueDate: string | null;
    assignee: string | null;
    overdue: boolean;
    event: { id: string; title: string } | null;
  }[];
}

type Panel =
  | { mode: "closed" }
  | { mode: "view"; eventId: string }
  | { mode: "new" };

export function Dashboard() {
  const { user } = useMe();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>({ mode: "closed" });

  const load = useCallback(async () => {
    const d = await api.get<DashboardData>("/api/dashboard");
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {greeting()}{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-ink-muted">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/timeline">
            <Button variant="secondary" size="sm">Day timeline</Button>
          </Link>
          <Link href="/calendar">
            <Button variant="secondary" size="sm">Month calendar</Button>
          </Link>
          <Button size="sm" onClick={() => setPanel({ mode: "new" })}>
            + New event
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-16 text-ink-muted">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Quick counts */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Events today" value={data.counts.eventsToday} />
            <Stat
              label="Tasks due today"
              value={data.counts.tasksDueToday}
              tone={data.counts.tasksDueToday > 0 ? "amber" : undefined}
            />
            <Stat
              label="Overdue tasks"
              value={data.counts.tasksOverdue}
              tone={data.counts.tasksOverdue > 0 ? "rose" : undefined}
            />
            <Stat label="Rooms tonight" value={data.counts.roomsTonight} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Today's events */}
            <div className="lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-ink">Today&rsquo;s events</h2>
              {data.eventsToday.length === 0 ? (
                <EmptyState icon="📅" title="Nothing scheduled today" description="Enjoy the quiet — or book something new." />
              ) : (
                <div className="space-y-2">
                  {data.eventsToday.map((e) => {
                    const status = e.status as EventStatus;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setPanel({ mode: "view", eventId: e.id })}
                        className="flex w-full items-center justify-between rounded-xl border border-base bg-surface p-3 text-left shadow-sm transition hover:border-brand-300"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${EVENT_STATUS_STYLES[status].dot}`} />
                            <span className="truncate font-medium text-ink">{e.title}</span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-ink-muted">
                            {e.company ?? e.client} · {e.spaces.join(", ")}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm text-ink-soft">
                            {formatTime(new Date(e.start))}–{formatTime(new Date(e.end))}
                          </div>
                          <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${EVENT_STATUS_STYLES[status].pill}`}>
                            {EVENT_STATUS_LABELS[status]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attention tasks */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">
                Needs attention
              </h2>
              {data.attention.length === 0 ? (
                <Card className="p-4 text-sm text-ink-muted">
                  No overdue or due-today tasks. 🎉
                </Card>
              ) : (
                <Card className="divide-y divide-base">
                  {data.attention.map((t) => (
                    <div key={t.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "h-2 w-2 shrink-0 rounded-full",
                            t.overdue ? "bg-rose-500" : "bg-amber-500",
                          )}
                        />
                        <span className="truncate text-sm text-ink">{t.title}</span>
                      </div>
                      <div className="ml-4 text-xs text-ink-muted">
                        {t.event ? (
                          <button
                            className="hover:text-brand-700 hover:underline"
                            onClick={() =>
                              t.event && setPanel({ mode: "view", eventId: t.event.id })
                            }
                          >
                            {t.event.title}
                          </button>
                        ) : null}
                        {t.dueDate
                          ? ` · ${t.overdue ? "overdue" : "due"} ${new Date(t.dueDate).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                  ))}
                </Card>
              )}
              <Link
                href="/tasks"
                className="mt-2 inline-block text-xs text-brand-600 hover:underline dark:text-brand-300"
              >
                View all tasks →
              </Link>
            </div>
          </div>
        </>
      )}

      <SidePanel open={panel.mode !== "closed"} onClose={() => setPanel({ mode: "closed" })}>
        {panel.mode === "new" ? (
          <NewEventPanel
            defaultDate={ymd(new Date())}
            onClose={() => setPanel({ mode: "closed" })}
            onCreated={(eventId) => {
              setPanel({ mode: "view", eventId });
              load();
            }}
          />
        ) : panel.mode === "view" ? (
          <EventDetailPanel
            eventId={panel.eventId}
            onClose={() => setPanel({ mode: "closed" })}
            onChanged={load}
          />
        ) : null}
      </SidePanel>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "rose";
}) {
  return (
    <Card className="p-4">
      <div
        className={clsx(
          "text-2xl font-semibold",
          tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-ink-muted">{label}</div>
    </Card>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
