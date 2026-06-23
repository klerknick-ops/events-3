"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/fetcher";
import type { RoomBooking, RoomType } from "@/lib/types";
import { ymd, formatDateLong } from "@/lib/dates";
import { formatMoney, lineTotals } from "@/lib/money";
import { nightsCount } from "@/lib/event-helpers";
import { Button, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface RoomConflictDetails {
  inventory: number;
  requested: number;
  overbookedNights: { date: string; alreadyBooked: number }[];
}

// Add or edit a hotel-room booking. Surfaces per-night inventory conflicts with
// the same warn + "book anyway" override pattern used for space/time slots.
export function RoomEditor({
  eventId,
  booking,
  rooms,
  defaultCheckIn,
  onClose,
  onSaved,
}: {
  eventId: string;
  booking: RoomBooking | null;
  rooms: RoomType[];
  defaultCheckIn: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roomTypeId, setRoomTypeId] = useState(
    booking?.roomTypeId ?? rooms[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(booking?.quantity ?? 1);
  const [checkIn, setCheckIn] = useState(
    booking ? ymd(new Date(booking.checkIn)) : defaultCheckIn,
  );
  const [checkOut, setCheckOut] = useState(
    booking ? ymd(new Date(booking.checkOut)) : nextDay(defaultCheckIn),
  );
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<RoomConflictDetails | null>(null);

  const room = rooms.find((r) => r.id === roomTypeId);
  const nights = nightsCount(checkIn, checkOut);
  const preview = room ? lineTotals(room.priceNet, quantity * nights, room.taxRate) : null;

  // Re-validation clears a stale conflict when inputs change.
  useEffect(() => setConflict(null), [roomTypeId, quantity, checkIn, checkOut]);

  async function save(force = false) {
    setSaving(true);
    setError(null);
    try {
      const payload = { roomTypeId, quantity, checkIn, checkOut, notes: notes || null, force };
      if (booking) await api.patch(`/api/room-bookings/${booking.id}`, payload);
      else await api.post(`/api/events/${eventId}/rooms`, payload);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(e.details as RoomConflictDetails);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={booking ? "Edit room booking" : "Add room booking"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {conflict ? (
            <Button variant="danger" onClick={() => save(true)} disabled={saving}>
              Book anyway
            </Button>
          ) : (
            <Button onClick={() => save(false)} disabled={saving || nights < 1}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Room type">
          <Select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.inventory} in stock)
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Rooms">
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Check-in">
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Check-out">
            <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. early check-in" />
        </Field>

        {preview ? (
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>
                {quantity} room{quantity > 1 ? "s" : ""} × {nights} night
                {nights !== 1 ? "s" : ""}
              </span>
              <span>{formatMoney(preview.net)}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-muted">
              <span>Tax ({room?.taxRate ?? 0}%)</span>
              <span>{formatMoney(preview.taxAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-base pt-1 font-semibold text-ink">
              <span>Total</span>
              <span>{formatMoney(preview.gross)}</span>
            </div>
          </div>
        ) : null}

        {conflict ? (
          <div className="rounded-lg border border-amber-400/60 bg-amber-500/10 p-3">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              ⚠ Not enough inventory
            </div>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/90">
              Only {conflict.inventory} of this room type exist. Over-capacity nights:
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
              {conflict.overbookedNights.map((n) => (
                <li key={n.date}>
                  • {formatDateLong(new Date(n.date))} — {n.alreadyBooked} already booked
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/90">
              Reduce quantity / change dates, or “Book anyway” to override.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return ymd(d);
}
