"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/fetcher";
import type { Space, TimelineSlot } from "@/lib/types";
import { addDays, formatDateLong, parseYmd, ymd, DAY_START_HOUR, DAY_END_HOUR } from "@/lib/dates";

const TIMELINE_LABEL_WIDTH = 184; // keep in sync with TimelineGrid LABEL_WIDTH
import { Button, EmptyState, Spinner } from "@/components/ui";
import { TimelineGrid } from "./TimelineGrid";
import { SidePanel } from "@/components/SidePanel";
import { NewEventPanel } from "@/components/event/NewEventPanel";
import { EventDetailPanel } from "@/components/event/EventDetailPanel";
import { ViewToggle } from "@/components/ViewToggle";
import { EVENT_STATUS_LABELS, EVENT_STATUS_STYLES, EVENT_STATUSES } from "@/lib/enums";

type Panel =
  | { mode: "closed" }
  | { mode: "view"; eventId: string }
  | {
      mode: "new";
      prefill?: { spaceId: string; startsAt: string; endsAt: string };
    };

const ZOOM_STEPS = [48, 64, 80, 110, 150];

export function TimelineApp() {
  const params = useSearchParams();
  const [day, setDay] = useState<Date>(() => {
    const dateParam = params.get("date");
    const d = dateParam ? parseYmd(dateParam) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [zoomIdx, setZoomIdx] = useState(2);
  // Measure the body so the day track fills wide screens (Phase 6, Section 9).
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setBodyWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fitPxPerHour =
    bodyWidth > 0
      ? Math.floor((bodyWidth - TIMELINE_LABEL_WIDTH - 24) / (DAY_END_HOUR - DAY_START_HOUR))
      : 0;
  const effectivePxPerHour = Math.max(ZOOM_STEPS[zoomIdx], fitPxPerHour);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(() => {
    const ev = params.get("event");
    return ev ? { mode: "view", eventId: ev } : { mode: "closed" };
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [sp, data] = await Promise.all([
      api.get<Space[]>("/api/spaces"),
      api.get<{ slots: TimelineSlot[] }>(`/api/events?date=${ymd(day)}`),
    ]);
    setSpaces(sp);
    setSlots(data.slots);
    setLoading(false);
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  function closePanel() {
    setPanel({ mode: "closed" });
  }

  const statusCounts = EVENT_STATUSES.map((s) => ({
    status: s,
    count: slots.filter((sl) => sl.event.status === s).length,
  })).filter((x) => x.count > 0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-base bg-surface px-4 py-3">
        <ViewToggle active="day" date={ymd(day)} />
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDay((d) => addDays(d, -1))}
            aria-label="Previous day"
          >
            ‹
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setDay(d);
            }}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDay((d) => addDays(d, 1))}
            aria-label="Next day"
          >
            ›
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={ymd(day)}
            onChange={(e) => {
              const [y, m, dd] = e.target.value.split("-").map(Number);
              if (y) setDay(new Date(y, m - 1, dd));
            }}
            className="h-8 rounded-lg border border-base px-2 text-sm"
          />
          <span className="text-sm font-medium text-ink">
            {formatDateLong(day)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Legend */}
          <div className="hidden items-center gap-2 md:flex">
            {statusCounts.map(({ status, count }) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 text-xs text-ink-muted"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${EVENT_STATUS_STYLES[status].dot}`}
                />
                {EVENT_STATUS_LABELS[status]} ({count})
              </span>
            ))}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              aria-label="Zoom out"
            >
              −
            </Button>
            <span className="text-xs text-ink-muted">Zoom</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
              }
              aria-label="Zoom in"
            >
              +
            </Button>
          </div>

          {/* New event (top-right) */}
          <Button onClick={() => setPanel({ mode: "new" })}>+ New event</Button>
        </div>
      </div>

      {/* Timeline body */}
      <div ref={bodyRef} className="flex-1 overflow-auto bg-surface-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-ink-muted">
            <Spinner />
          </div>
        ) : spaces.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="🏛"
              title="No bookable spaces yet"
              description="Add spaces in Configuration — they appear here as timeline rows."
              action={
                <a href="/config/spaces">
                  <Button>Go to Configuration</Button>
                </a>
              }
            />
          </div>
        ) : (
          <TimelineGrid
            spaces={spaces}
            slots={slots}
            day={day}
            pxPerHour={effectivePxPerHour}
            onSlotClick={(slot) =>
              setPanel({ mode: "view", eventId: slot.event.id })
            }
            onEmptyClick={(spaceId, startsAt, endsAt) =>
              setPanel({
                mode: "new",
                prefill: {
                  spaceId,
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                },
              })
            }
          />
        )}
      </div>

      {/* Left slide-in panel */}
      <SidePanel open={panel.mode !== "closed"} onClose={closePanel}>
        {panel.mode === "new" ? (
          <NewEventPanel
            prefill={panel.prefill}
            defaultDate={ymd(day)}
            onClose={closePanel}
            onCreated={(eventId) => {
              setPanel({ mode: "view", eventId });
              load();
            }}
          />
        ) : panel.mode === "view" ? (
          <EventDetailPanel
            eventId={panel.eventId}
            onClose={closePanel}
            onChanged={load}
          />
        ) : null}
      </SidePanel>
    </div>
  );
}
