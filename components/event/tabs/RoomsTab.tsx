"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { EventFull, RoomBooking, RoomType } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { computeRoomTotals } from "@/lib/event-helpers";
import { formatDateLong } from "@/lib/dates";
import { Button } from "@/components/ui";
import { Empty, MoneyRow, SectionHeader } from "../PanelBits";
import { RoomEditor } from "../RoomEditor";

export function RoomsTab({
  event,
  reload,
}: {
  event: EventFull;
  reload: () => void;
}) {
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [editor, setEditor] = useState<{ booking: RoomBooking | null } | null>(null);

  useEffect(() => {
    api.get<RoomType[]>("/api/rooms").then(setRooms);
  }, []);

  const { lines, totals } = computeRoomTotals(event.roomBookings);
  // Default check-in = event's first day.
  const firstDate = event.days[0]
    ? new Date(event.days[0].date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <section>
      <SectionHeader
        title="Hotel rooms"
        action={
          <Button
            size="sm"
            variant="subtle"
            disabled={rooms.length === 0}
            onClick={() => setEditor({ booking: null })}
          >
            + Add rooms
          </Button>
        }
      />

      {rooms.length === 0 ? (
        <Empty>No room types configured. Add some under Configuration → Hotel Rooms.</Empty>
      ) : event.roomBookings.length === 0 ? (
        <Empty>No rooms booked for this event yet.</Empty>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => {
            const booking = event.roomBookings.find((b) => b.id === l.id)!;
            return (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-base p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {l.quantity}× {l.title}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatDateLong(l.checkIn)} → {formatDateLong(l.checkOut)} ·{" "}
                    {l.nights} night{l.nights !== 1 ? "s" : ""}
                    {booking.notes ? ` · ${booking.notes}` : ""}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatMoney(l.unitNet)}/night · {l.taxRate}% tax
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {formatMoney(l.totals.gross)}
                  </span>
                  <button
                    className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-muted"
                    onClick={() => setEditor({ booking })}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10"
                    onClick={async () => {
                      await api.del(`/api/room-bookings/${l.id}`);
                      reload();
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          <div className="rounded-lg border border-base bg-surface-2 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Room block total
            </div>
            <MoneyRow label="Net" value={formatMoney(totals.net)} />
            {totals.byRate.map((r) => (
              <MoneyRow
                key={r.taxRate}
                small
                label={`Tax @ ${r.taxRate}%`}
                value={formatMoney(r.taxAmount)}
              />
            ))}
            <MoneyRow label="Total" value={formatMoney(totals.gross)} strong />
          </div>
        </div>
      )}

      {editor ? (
        <RoomEditor
          eventId={event.id}
          booking={editor.booking}
          rooms={rooms}
          defaultCheckIn={firstDate}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}
