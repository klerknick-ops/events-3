"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/fetcher";
import type { TimelineSlot } from "@/lib/types";
import { parseYmd, ymd, formatTime } from "@/lib/dates";
import { EVENT_STATUS_STYLES } from "@/lib/enums";
import { Button, Spinner } from "@/components/ui";
import { ViewToggle } from "@/components/ViewToggle";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday-start 6-week grid covering the given month.
function gridDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function MonthCalendar() {
  const router = useRouter();
  const params = useSearchParams();
  const [month, setMonth] = useState<Date>(() => {
    const dp = params.get("date");
    const base = dp ? parseYmd(dp) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => gridDays(month), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = ymd(days[0]);
    const to = ymd(days[days.length - 1]);
    const data = await api.get<{ slots: TimelineSlot[] }>(
      `/api/events?from=${from}&to=${to}`,
    );
    setSlots(data.slots);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  // Map YYYY-MM-DD -> distinct events occurring that day (earliest slot first).
  const byDay = useMemo(() => {
    const m = new Map<
      string,
      { id: string; title: string; status: string; time: string }[]
    >();
    for (const s of slots) {
      const key = ymd(new Date(s.startsAt));
      const arr = m.get(key) ?? [];
      if (!arr.some((e) => e.id === s.event.id)) {
        arr.push({
          id: s.event.id,
          title: s.event.title,
          status: s.event.status,
          time: formatTime(new Date(s.startsAt)),
        });
      }
      m.set(key, arr);
    }
    return m;
  }, [slots]);

  const todayKey = ymd(new Date());
  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ViewToggle active="month" date={ymd(month)} />
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)} aria-label="Next month">
            ›
          </Button>
        </div>
        <input
          type="date"
          value={ymd(month)}
          onChange={(e) => {
            if (e.target.value) {
              const d = parseYmd(e.target.value);
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }
          }}
          className="h-8 rounded-lg border border-base bg-surface px-2 text-sm text-ink"
        />
        <span className="text-sm font-semibold text-ink">{monthLabel}</span>
        {loading ? <Spinner className="text-ink-muted" /> : null}
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-xl border border-base bg-base text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-surface py-2 text-xs font-semibold text-ink-muted">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-xl border border-t-0 border-base bg-base">
        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = key === todayKey;
          const events = byDay.get(key) ?? [];
          return (
            <button
              key={key}
              onClick={() => router.push(`/timeline?date=${key}`)}
              className={clsx(
                "min-h-[104px] bg-surface p-1.5 text-left align-top transition-colors hover:bg-muted",
                !inMonth && "opacity-45",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={clsx(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday
                      ? "bg-brand-600 font-semibold text-white"
                      : "text-ink-soft",
                  )}
                >
                  {d.getDate()}
                </span>
                {events.length > 0 ? (
                  <span className="text-[10px] text-ink-muted">{events.length}</span>
                ) : null}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className={clsx(
                      "truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                      EVENT_STATUS_STYLES[e.status as keyof typeof EVENT_STATUS_STYLES]?.block ??
                        "bg-muted text-ink",
                    )}
                    title={`${e.title} · ${e.time}`}
                  >
                    {e.time} {e.title}
                  </div>
                ))}
                {events.length > 3 ? (
                  <div className="px-1 text-[10px] text-ink-muted">
                    +{events.length - 3} more
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
