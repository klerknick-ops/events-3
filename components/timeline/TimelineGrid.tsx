"use client";

import { useRef } from "react";
import clsx from "clsx";
import type { Space, TimelineSlot } from "@/lib/types";
import { EVENT_STATUS_STYLES } from "@/lib/enums";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_RESOLUTION_MIN,
  TIMELINE_TOTAL_MIN,
  formatTime,
  snapMinutes,
} from "@/lib/dates";

const ROW_HEIGHT = 68;
const LABEL_WIDTH = 184;

export function TimelineGrid({
  spaces,
  slots,
  day,
  pxPerHour,
  onSlotClick,
  onEmptyClick,
}: {
  spaces: Space[];
  slots: TimelineSlot[];
  day: Date;
  pxPerHour: number;
  onSlotClick: (slot: TimelineSlot) => void;
  onEmptyClick: (spaceId: string, startsAt: Date, endsAt: Date) => void;
}) {
  const trackWidth = ((DAY_END_HOUR - DAY_START_HOUR) * pxPerHour);
  const hours: number[] = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) hours.push(h);

  const slotsBySpace = new Map<string, TimelineSlot[]>();
  for (const s of slots) {
    const arr = slotsBySpace.get(s.spaceId) ?? [];
    arr.push(s);
    slotsBySpace.set(s.spaceId, arr);
  }

  // Convert a Date to an x-offset (px) within the day track, clamped to window.
  function xFor(d: Date): number {
    const min = d.getHours() * 60 + d.getMinutes() - DAY_START_HOUR * 60;
    const clamped = Math.max(0, Math.min(TIMELINE_TOTAL_MIN, min));
    return (clamped / TIMELINE_TOTAL_MIN) * trackWidth;
  }

  const now = new Date();
  const isToday =
    now.getFullYear() === day.getFullYear() &&
    now.getMonth() === day.getMonth() &&
    now.getDate() === day.getDate();
  const nowX = xFor(now);

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div style={{ width: LABEL_WIDTH + trackWidth }}>
        {/* Time axis header */}
        <div className="sticky top-0 z-20 flex border-b border-base bg-surface">
          <div
            className="shrink-0 border-r border-base px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
            style={{ width: LABEL_WIDTH }}
          >
            Spaces
          </div>
          <div className="relative" style={{ width: trackWidth, height: 36 }}>
            {hours.map((h) => {
              const x =
                ((h - DAY_START_HOUR) * 60 / TIMELINE_TOTAL_MIN) * trackWidth;
              return (
                <div
                  key={h}
                  className="absolute top-0 flex h-full items-center"
                  style={{ left: x }}
                >
                  <span className="-translate-x-1/2 text-[11px] text-ink-muted">
                    {String(h % 24).padStart(2, "0")}:00
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {spaces.map((space) => {
            const rowSlots = slotsBySpace.get(space.id) ?? [];
            return (
              <div
                key={space.id}
                className="flex border-b border-base"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Space label */}
                <div
                  className="flex shrink-0 items-center gap-2 border-r border-base bg-surface px-3"
                  style={{ width: LABEL_WIDTH }}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: space.color }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {space.name}
                    </div>
                    {space.capacity ? (
                      <div className="text-[11px] text-ink-muted">
                        cap. {space.capacity}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Track */}
                <TimelineRow
                  trackWidth={trackWidth}
                  pxPerHour={pxPerHour}
                  onEmptyClick={(startsAt, endsAt) =>
                    onEmptyClick(space.id, startsAt, endsAt)
                  }
                  day={day}
                >
                  {rowSlots.map((slot) => {
                    const left = xFor(new Date(slot.startsAt));
                    const right = xFor(new Date(slot.endsAt));
                    const width = Math.max(right - left, 8);
                    const style =
                      EVENT_STATUS_STYLES[slot.event.status] ??
                      EVENT_STATUS_STYLES.INQUIRY;
                    return (
                      <button
                        key={slot.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSlotClick(slot);
                        }}
                        className={clsx(
                          "group absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm transition hover:z-10 hover:shadow-md",
                          style.block,
                        )}
                        style={{ left, width }}
                        title={`${slot.event.title} · ${formatTime(
                          new Date(slot.startsAt),
                        )}–${formatTime(new Date(slot.endsAt))}`}
                      >
                        <div className="truncate text-xs font-semibold leading-tight">
                          {slot.event.title}
                        </div>
                        <div className="truncate text-[11px] leading-tight opacity-90">
                          {slot.label ? `${slot.label} · ` : ""}
                          {formatTime(new Date(slot.startsAt))}–
                          {formatTime(new Date(slot.endsAt))}
                        </div>
                      </button>
                    );
                  })}
                </TimelineRow>
              </div>
            );
          })}

          {/* "Now" indicator */}
          {isToday ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-rose-500"
              style={{ left: LABEL_WIDTH + nowX }}
            >
              <div className="absolute -top-1 -left-[3px] h-1.5 w-1.5 rounded-full bg-rose-500" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  trackWidth,
  pxPerHour,
  onEmptyClick,
  day,
  children,
}: {
  trackWidth: number;
  pxPerHour: number;
  onEmptyClick: (startsAt: Date, endsAt: Date) => void;
  day: Date;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const minutesFromStart = (x / trackWidth) * TIMELINE_TOTAL_MIN;
    const snapped = snapMinutes(minutesFromStart, SLOT_RESOLUTION_MIN);
    const startMin = DAY_START_HOUR * 60 + snapped;
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(startMin);
    const end = new Date(start.getTime() + 120 * 60000); // default 2h
    onEmptyClick(start, end);
  }

  // Quarter-hour gridlines via background gradient.
  const quarterPx = pxPerHour / 4;

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className="relative flex-1 cursor-copy"
      style={{
        width: trackWidth,
        backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.18) 0, rgba(148,163,184,0.18) 1px, transparent 1px, transparent ${pxPerHour}px), repeating-linear-gradient(to right, rgba(148,163,184,0.07) 0, rgba(148,163,184,0.07) 1px, transparent 1px, transparent ${quarterPx}px)`,
      }}
    >
      {children}
    </div>
  );
}
