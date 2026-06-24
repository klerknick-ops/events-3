"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidePanel } from "@/components/SidePanel";
import { EventDetailPanel } from "@/components/event/EventDetailPanel";
import { EVENT_STATUS_LABELS, EVENT_STATUS_STYLES, type EventStatus } from "@/lib/enums";

export interface EventRow {
  id: string;
  title: string;
  status: EventStatus;
  dateLabel: string;
  slots: number;
  products: number;
  tasks: number;
  totalLabel: string;
}

// Clickable event-history list that opens the shared Event Detail Panel in place
// (reused from the timeline / everywhere else).
export function ContactEventList({ events }: { events: EventRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <>
      <div className="space-y-3">
        {events.map((ev) => (
          <button
            key={ev.id}
            onClick={() => setOpenId(ev.id)}
            className="block w-full rounded-xl border border-base bg-surface p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-ink">{ev.title}</div>
                <div className="text-xs text-ink-muted">{ev.dateLabel}</div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${EVENT_STATUS_STYLES[ev.status].pill}`}
              >
                {EVENT_STATUS_LABELS[ev.status]}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span>🕑 {ev.slots} slots</span>
              <span>🍽 {ev.products} products</span>
              <span>✓ {ev.tasks} tasks</span>
              <span className="font-medium text-ink">{ev.totalLabel} total</span>
            </div>
          </button>
        ))}
      </div>

      <SidePanel open={!!openId} onClose={() => setOpenId(null)}>
        {openId ? (
          <EventDetailPanel
            eventId={openId}
            onClose={() => setOpenId(null)}
            onChanged={() => router.refresh()}
          />
        ) : null}
      </SidePanel>
    </>
  );
}
