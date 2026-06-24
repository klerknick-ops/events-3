"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/fetcher";
import type { Setup, Space, TimeSlot } from "@/lib/types";
import { combineDateTime, hhmm, ymd } from "@/lib/dates";
import { formatDateTimeRange, formatTime } from "@/lib/dates";
import { resolveSetup } from "@/lib/setup-rules";
import { Button, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/Modal";
import type { SlotConflict } from "@/lib/conflicts";

// Add or edit a time slot: space, date/time, person count, and room setup
// (with auto-applied layout rules + manual override). Handles 409 conflicts.
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
  const [spaceId, setSpaceId] = useState(slot?.spaceId ?? spaces[0]?.id ?? "");
  const [label, setLabel] = useState(slot?.label ?? "");
  const [date, setDate] = useState(slot ? ymd(new Date(slot.startsAt)) : defaultDate);
  const [start, setStart] = useState(slot ? hhmm(new Date(slot.startsAt)) : "12:00");
  const [end, setEnd] = useState(slot ? hhmm(new Date(slot.endsAt)) : "14:00");
  const [personCount, setPersonCount] = useState(slot?.personCount ?? 0);

  const [setups, setSetups] = useState<Setup[]>([]);
  const [setupId, setSetupId] = useState(slot?.setupId ?? "");
  const [manual, setManual] = useState(slot?.setupManual ?? false);
  const [ovrTables, setOvrTables] = useState<string>(
    slot?.setupTableCount != null ? String(slot.setupTableCount) : "",
  );
  const [ovrHead, setOvrHead] = useState(slot?.setupHeadTables ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SlotConflict[] | null>(null);

  // Load setups for the chosen space; drop the selection if it no longer fits.
  useEffect(() => {
    if (!spaceId) {
      setSetups([]);
      return;
    }
    api.get<Setup[]>(`/api/spaces/${spaceId}/setups`).then((s) => {
      setSetups(s);
      setSetupId((cur) => (s.some((x) => x.id === cur) ? cur : ""));
    });
  }, [spaceId]);

  const selectedSetup = setups.find((s) => s.id === setupId);
  const auto = selectedSetup
    ? resolveSetup(selectedSetup.rules ?? [], personCount)
    : { tableCount: null, headTables: false };
  const effectiveTables = manual ? (ovrTables ? Number(ovrTables) : null) : auto.tableCount;
  const effectiveHead = manual ? ovrHead : auto.headTables;

  async function save(force = false) {
    setSaving(true);
    setError(null);
    const startsAt = combineDateTime(date, start).toISOString();
    const endsAt = combineDateTime(date, end).toISOString();
    const payload = {
      spaceId,
      label: label || null,
      startsAt,
      endsAt,
      personCount,
      setupId: setupId || null,
      setupManual: manual,
      setupTableCount: manual ? (ovrTables ? Number(ovrTables) : null) : auto.tableCount,
      setupHeadTables: effectiveHead,
      force,
    };
    try {
      if (slot) await api.patch(`/api/slots/${slot.id}`, payload);
      else await api.post(`/api/events/${eventId}/slots`, payload);
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
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ceremony, Dinner, Breakout…" />
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Start">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End">
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="People">
            <Input
              type="number"
              min={0}
              value={personCount}
              onChange={(e) => setPersonCount(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>

        <Field label="Setup (room layout)">
          <Select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
            <option value="">— None —</option>
            {setups.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {setups.length === 0 && spaceId ? (
            <p className="mt-1 text-xs text-ink-muted">
              No setups configured for this space yet (Configuration → Bookable Spaces → Setups).
            </p>
          ) : null}
        </Field>

        {selectedSetup ? (
          <div className="rounded-lg border border-base bg-surface-2 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Layout {manual ? "(manual override)" : "(auto from rules)"}
              </span>
              <label className="flex items-center gap-1 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => {
                    setManual(e.target.checked);
                    if (e.target.checked) {
                      setOvrTables(auto.tableCount != null ? String(auto.tableCount) : "");
                      setOvrHead(auto.headTables);
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-base"
                />
                Override
              </label>
            </div>
            {manual ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-ink-muted">
                  Tables
                  <Input
                    type="number"
                    min={0}
                    className="mt-0.5 h-9"
                    value={ovrTables}
                    onChange={(e) => setOvrTables(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={ovrHead}
                    onChange={(e) => setOvrHead(e.target.checked)}
                    className="h-4 w-4 rounded border-base"
                  />
                  Head tables
                </label>
              </div>
            ) : (
              <div className="mt-1 text-ink-soft">
                {effectiveTables != null ? `${effectiveTables} table${effectiveTables === 1 ? "" : "s"}` : "Layout as configured"}
                {effectiveHead ? " · head/end tables" : ""}
                <span className="ml-1 text-ink-muted">at {personCount} guests</span>
              </div>
            )}
          </div>
        ) : null}

        {conflicts && conflicts.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              ⚠ Double-booking conflict
            </div>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-200/80">
              This space is already booked during this time:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-100">
              {conflicts.map((c) => (
                <li key={c.slotId}>
                  • <strong>{c.eventTitle}</strong> {formatTime(new Date(c.startsAt))}–
                  {formatTime(new Date(c.endsAt))}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-200/80">
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
