"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/fetcher";
import type { Space, TimelineSlot } from "@/lib/types";
import { addDays, combineDateTime, formatTime, parseYmd, ymd } from "@/lib/dates";
import { EVENT_STATUS_STYLES } from "@/lib/enums";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { ViewToggle } from "@/components/ViewToggle";
import { SidePanel } from "@/components/SidePanel";
import { NewEventPanel } from "@/components/event/NewEventPanel";
import { EventDetailPanel } from "@/components/event/EventDetailPanel";

type Panel =
  | { mode: "closed" }
  | { mode: "view"; eventId: string }
  | { mode: "new"; prefill?: { spaceId: string; startsAt: string; endsAt: string } };

const WEEKDAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: "short" });

// Monday of the week containing `d`.
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const offset = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - offset);
  return x;
}

export function WeekTimeline() {
  const params = useSearchParams();
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const dp = params.get("date");
    return startOfWeek(dp ? parseYmd(dp) : new Date());
  });
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(() => {
    const ev = params.get("event");
    return ev ? { mode: "view", eventId: ev } : { mode: "closed" };
  });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [sp, data] = await Promise.all([
      api.get<Space[]>("/api/spaces"),
      api.get<{ slots: TimelineSlot[] }>(
        `/api/events?from=${ymd(days[0])}&to=${ymd(days[6])}`,
      ),
    ]);
    setSpaces(sp);
    setSlots(data.slots);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  function closePanel() {
    setPanel({ mode: "closed" });
  }

  // (spaceId, YYYY-MM-DD) -> slots, sorted by start time.
  const byCell = useMemo(() => {
    const m = new Map<string, TimelineSlot[]>();
    for (const s of slots) {
      const key = `${s.spaceId}|${ymd(new Date(s.startsAt))}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    for (const arr of m.values())
      arr.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    return m;
  }, [slots]);

  const todayKey = ymd(new Date());
  const rangeLabel = `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-base bg-surface px-4 py-3">
        <ViewToggle active="week" date={ymd(weekStart)} />
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="Previous week">
            ‹
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="Next week">
            ›
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={ymd(weekStart)}
            onChange={(e) => {
              if (e.target.value) setWeekStart(startOfWeek(parseYmd(e.target.value)));
            }}
            className="h-8 rounded-lg border border-base bg-surface px-2 text-sm text-ink"
          />
          <span className="text-sm font-medium text-ink">{rangeLabel}</span>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setPanel({ mode: "new" })}>+ New event</Button>
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 overflow-auto bg-surface-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-ink-muted">
            <Spinner />
          </div>
        ) : spaces.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="🏛"
              title="No bookable spaces yet"
              description="Add spaces in Configuration — they appear here as rows."
              action={<a href="/config/spaces"><Button>Go to Configuration</Button></a>}
            />
          </div>
        ) : (
          <div className="min-w-[900px]">
            {/* Day header */}
            <div className="sticky top-0 z-10 grid grid-cols-[160px_repeat(7,1fr)] border-b border-base bg-surface">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Spaces
              </div>
              {days.map((d) => {
                const isToday = ymd(d) === todayKey;
                return (
                  <div key={ymd(d)} className="border-l border-base px-2 py-2 text-center">
                    <div className="text-[11px] uppercase tracking-wide text-ink-muted">
                      {WEEKDAY_FMT.format(d)}
                    </div>
                    <div
                      className={clsx(
                        "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isToday ? "bg-brand-600 font-semibold text-white" : "text-ink-soft",
                      )}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Space rows */}
            {spaces.map((space) => (
              <div
                key={space.id}
                className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-base"
              >
                <div className="flex items-center gap-2 bg-surface px-3 py-2">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: space.color }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{space.name}</div>
                    {space.capacity ? (
                      <div className="text-[11px] text-ink-muted">cap. {space.capacity}</div>
                    ) : null}
                  </div>
                </div>
                {days.map((d) => {
                  const cellSlots = byCell.get(`${space.id}|${ymd(d)}`) ?? [];
                  return (
                    <div
                      key={ymd(d)}
                      onClick={() => {
                        const start = combineDateTime(ymd(d), "12:00");
                        const end = combineDateTime(ymd(d), "14:00");
                        setPanel({
                          mode: "new",
                          prefill: {
                            spaceId: space.id,
                            startsAt: start.toISOString(),
                            endsAt: end.toISOString(),
                          },
                        });
                      }}
                      className="min-h-[72px] cursor-copy space-y-1 border-l border-base bg-surface p-1 transition-colors hover:bg-muted"
                    >
                      {cellSlots.map((s) => {
                        const style = EVENT_STATUS_STYLES[s.event.status] ?? EVENT_STATUS_STYLES.INQUIRY;
                        return (
                          <button
                            key={s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPanel({ mode: "view", eventId: s.event.id });
                            }}
                            title={`${s.event.title} · ${formatTime(new Date(s.startsAt))}–${formatTime(new Date(s.endsAt))}`}
                            className={clsx(
                              "block w-full truncate rounded border px-1 py-0.5 text-left text-[11px] leading-tight",
                              style.block,
                            )}
                          >
                            {formatTime(new Date(s.startsAt))} {s.event.title}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Left slide-in panel (shared with day view) */}
      <SidePanel open={panel.mode !== "closed"} onClose={closePanel}>
        {panel.mode === "new" ? (
          <NewEventPanel
            prefill={panel.prefill}
            defaultDate={ymd(weekStart)}
            onClose={closePanel}
            onCreated={(eventId) => {
              setPanel({ mode: "view", eventId });
              load();
            }}
          />
        ) : panel.mode === "view" ? (
          <EventDetailPanel eventId={panel.eventId} onClose={closePanel} onChanged={load} />
        ) : null}
      </SidePanel>
    </div>
  );
}
