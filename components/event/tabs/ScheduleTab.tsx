"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import type { EventFull, Space, TimeSlot } from "@/lib/types";
import { formatDateTimeRange } from "@/lib/dates";
import { Button } from "@/components/ui";
import { Empty, SectionHeader } from "../PanelBits";
import { SlotEditor } from "../SlotEditor";

export function ScheduleTab({
  event,
  selectedDayId,
  spaces,
  reload,
}: {
  event: EventFull;
  selectedDayId: string | null;
  spaces: Space[];
  reload: () => void;
}) {
  const [slotEditor, setSlotEditor] = useState<{ slot: TimeSlot | null } | null>(
    null,
  );

  const day = event.days.find((d) => d.id === selectedDayId) ?? event.days[0];
  const daySlots = event.timeSlots
    .filter((s) => (day ? s.dayId === day.id : true))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const defaultDate = (day ? new Date(day.date) : new Date())
    .toISOString()
    .slice(0, 10);

  return (
    <section>
      <SectionHeader
        title="Time slots"
        action={
          <Button size="sm" variant="subtle" onClick={() => setSlotEditor({ slot: null })}>
            + Add slot
          </Button>
        }
      />
      {daySlots.length === 0 ? (
        <Empty>No time slots on this day yet.</Empty>
      ) : (
        <div className="space-y-2">
          {daySlots.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-base p-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-8 w-1.5 rounded-full"
                  style={{ background: s.space?.color ?? "#cbd5e1" }}
                />
                <div>
                  <div className="text-sm font-medium text-ink">
                    {s.label ? `${s.label} · ` : ""}
                    {s.space?.name}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatDateTimeRange(new Date(s.startsAt), new Date(s.endsAt))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-muted"
                  onClick={() => setSlotEditor({ slot: s })}
                >
                  Edit
                </button>
                <button
                  className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10"
                  onClick={async () => {
                    await api.del(`/api/slots/${s.id}`);
                    reload();
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {slotEditor ? (
        <SlotEditor
          eventId={event.id}
          slot={slotEditor.slot}
          spaces={spaces}
          defaultDate={defaultDate}
          onClose={() => setSlotEditor(null)}
          onSaved={() => {
            setSlotEditor(null);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}
