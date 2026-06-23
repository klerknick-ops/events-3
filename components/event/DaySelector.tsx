"use client";

import { useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/fetcher";
import type { EventDay } from "@/lib/types";
import { addDays, formatDateLong, ymd } from "@/lib/dates";
import { Button, Field, Input } from "@/components/ui";
import { Modal } from "@/components/Modal";

// Day navigation + management for multi-day events. The chip row only renders
// when there is more than one day; the "add day" control is always available.
export function DaySelector({
  eventId,
  days,
  selectedDayId,
  onSelect,
  onChanged,
}: {
  eventId: string;
  days: EventDay[];
  selectedDayId: string | null;
  onSelect: (dayId: string) => void;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const current = days.find((d) => d.id === selectedDayId) ?? days[0];

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {days.length > 1 &&
          days.map((d, i) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                d.id === (selectedDayId ?? days[0]?.id)
                  ? "border-brand-500 bg-accent text-brand-700 dark:text-brand-200"
                  : "border-base text-ink-muted hover:bg-muted",
              )}
            >
              Day {i + 1}
              <span className="ml-1 opacity-70">
                {new Date(d.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </button>
          ))}

        <Button size="sm" variant="subtle" onClick={() => setAdding(true)}>
          + Add day
        </Button>

        {days.length > 1 && current ? (
          <button
            onClick={async () => {
              if (confirm("Delete this day and everything on it?")) {
                await api.del(`/api/days/${current.id}`);
                onChanged();
              }
            }}
            className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10"
          >
            Delete day
          </button>
        ) : null}
      </div>

      {adding ? (
        <AddDayModal
          eventId={eventId}
          currentDay={current}
          onClose={() => setAdding(false)}
          onAdded={(dayId) => {
            setAdding(false);
            onChanged();
            onSelect(dayId);
          }}
        />
      ) : null}
    </div>
  );
}

function AddDayModal({
  eventId,
  currentDay,
  onClose,
  onAdded,
}: {
  eventId: string;
  currentDay: EventDay | undefined;
  onClose: () => void;
  onAdded: (dayId: string) => void;
}) {
  const suggested = currentDay
    ? ymd(addDays(new Date(currentDay.date), 1))
    : ymd(new Date());
  const [date, setDate] = useState(suggested);
  const [copy, setCopy] = useState(Boolean(currentDay));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const day = await api.post<{ id: string }>(`/api/events/${eventId}/days`, {
        date,
        copyFromDayId: copy && currentDay ? currentDay.id : null,
      });
      onAdded(day.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a day"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Adding…" : "Add day"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {currentDay ? (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={copy}
              onChange={(e) => setCopy(e.target.checked)}
              className="h-4 w-4 rounded border-base"
            />
            Copy {formatDateLong(new Date(currentDay.date))}&rsquo;s plan (slots &
            products) onto the new day
          </label>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
