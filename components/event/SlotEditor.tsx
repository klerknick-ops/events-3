"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/fetcher";
import type { Space, TimeSlot } from "@/lib/types";
import { combineDateTime, hhmm, ymd } from "@/lib/dates";
import { formatDateTimeRange, formatTime } from "@/lib/dates";
import { Button, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/Modal";
import type { SlotConflict } from "@/lib/conflicts";

// Add or edit a time slot. Handles 409 conflict responses by surfacing the
// conflicting bookings and offering a "book anyway" override (force).
export function SlotEditor({
  eventId,
  slot,
  spaces,
  defaultDate,
  onClose,
  onSaved,
}: {
  eventId: string;
  slot: TimeSlot | null;
  spaces: Space[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const init = slot
    ? {
        spaceId: slot.spaceId,
        label: slot.label ?? "",
        date: ymd(new Date(slot.startsAt)),
        start: hhmm(new Date(slot.startsAt)),
        end: hhmm(new Date(slot.endsAt)),
      }
    : {
        spaceId: spaces[0]?.id ?? "",
        label: "",
        date: defaultDate,
        start: "12:00",
        end: "14:00",
      };

  const [spaceId, setSpaceId] = useState(init.spaceId);
  const [label, setLabel] = useState(init.label);
  const [date, setDate] = useState(init.date);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SlotConflict[] | null>(null);

  async function save(force = false) {
    setSaving(true);
    setError(null);
    const startsAt = combineDateTime(date, start).toISOString();
    const endsAt = combineDateTime(date, end).toISOString();
    try {
      if (slot) {
        await api.patch(`/api/slots/${slot.id}`, {
          spaceId,
          label: label || null,
          startsAt,
          endsAt,
          force,
        });
      } else {
        await api.post(`/api/events/${eventId}/slots`, {
          spaceId,
          label: label || null,
          startsAt,
          endsAt,
          force,
        });
      }
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const details = e.details as { conflicts: SlotConflict[] } | undefined;
        setConflicts(details?.conflicts ?? []);
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
      title={slot ? "Edit time slot" : "Add time slot"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {conflicts && conflicts.length > 0 ? (
            <Button variant="danger" onClick={() => save(true)} disabled={saving}>
              Book anyway
            </Button>
          ) : (
            <Button onClick={() => save(false)} disabled={saving}>
              {saving ? "Saving…" : "Save slot"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Label (optional)">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ceremony, Dinner, Breakout…"
          />
        </Field>
        <Field label="Space">
          <Select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="End">
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>

        {conflicts && conflicts.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-800">
              ⚠ Double-booking conflict
            </div>
            <p className="mt-0.5 text-xs text-amber-700">
              This space is already booked during this time:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {conflicts.map((c) => (
                <li key={c.slotId}>
                  • <strong>{c.eventTitle}</strong>{" "}
                  {formatTime(new Date(c.startsAt))}–
                  {formatTime(new Date(c.endsAt))}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-700">
              Change the time/space, or “Book anyway” to override.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

export { formatDateTimeRange };
