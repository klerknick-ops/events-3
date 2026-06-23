"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/fetcher";
import type { EventFull, Space } from "@/lib/types";
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
  type EventStatus,
} from "@/lib/enums";
import { useCan } from "@/components/MeProvider";
import { Button, Spinner } from "@/components/ui";
import { PanelHeader } from "@/components/SidePanel";
import { InlineTitle } from "./PanelBits";
import { DaySelector } from "./DaySelector";
import { ScheduleTab } from "./tabs/ScheduleTab";
import { ProductsTab } from "./tabs/ProductsTab";
import { TasksTab } from "./tabs/TasksTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { NotesTab } from "./tabs/NotesTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { ExportMenu } from "./ExportMenu";

type TabKey = "schedule" | "products" | "rooms" | "tasks" | "notes" | "activity";
const TABS: { key: TabKey; label: string }[] = [
  { key: "schedule", label: "Schedule" },
  { key: "products", label: "Products" },
  { key: "rooms", label: "Rooms" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
  { key: "activity", label: "Activity" },
];
// Day selector is only relevant to day-scoped tabs.
const DAY_SCOPED: TabKey[] = ["schedule", "products"];

export function EventDetailPanel({
  eventId,
  onClose,
  onChanged,
}: {
  eventId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [event, setEvent] = useState<EventFull | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("schedule");
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const canDelete = useCan("DELETE_EVENT");
  const canCancel = useCan("CANCEL_EVENT");

  const reload = useCallback(async () => {
    const ev = await api.get<EventFull>(`/api/events/${eventId}`);
    setEvent(ev);
    setSelectedDayId((cur) =>
      cur && ev.days.some((d) => d.id === cur) ? cur : ev.days[0]?.id ?? null,
    );
    onChanged();
  }, [eventId, onChanged]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ev, sp] = await Promise.all([
        api.get<EventFull>(`/api/events/${eventId}`),
        api.get<Space[]>("/api/spaces"),
      ]);
      setEvent(ev);
      setSpaces(sp);
      setSelectedDayId(ev.days[0]?.id ?? null);
      setLoading(false);
    })();
  }, [eventId]);

  if (loading || !event) {
    return (
      <>
        <PanelHeader title="Event" onClose={onClose} />
        <div className="flex flex-1 items-center justify-center text-ink-muted">
          <Spinner />
        </div>
      </>
    );
  }

  const status = event.status as EventStatus;

  return (
    <>
      <PanelHeader
        title={
          <InlineTitle
            value={event.title}
            onSave={async (title) => {
              await api.patch(`/api/events/${eventId}`, { title });
              reload();
            }}
          />
        }
        subtitle={
          <Link
            href={`/clients/contact/${event.contact.id}`}
            className="hover:text-brand-700 hover:underline"
          >
            {event.contact.firstName} {event.contact.lastName}
            {event.contact.company ? ` · ${event.contact.company.name}` : ""}
          </Link>
        }
        onClose={onClose}
        right={
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${EVENT_STATUS_STYLES[status].pill}`}
          >
            {EVENT_STATUS_LABELS[status]}
          </span>
        }
      />

      {/* Status control */}
      <div className="border-b border-base px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {EVENT_STATUSES.map((s) => {
            const disabled = s === "CANCELLED" && !canCancel;
            return (
              <button
                key={s}
                disabled={disabled}
                title={disabled ? "You can't cancel events" : undefined}
                onClick={async () => {
                  await api.patch(`/api/events/${eventId}`, { status: s });
                  reload();
                }}
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  s === status
                    ? EVENT_STATUS_STYLES[s].pill + " ring-1 ring-ink/20"
                    : "border-base text-ink-muted hover:bg-muted",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                {EVENT_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-base px-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-brand-600 text-brand-700 dark:text-brand-300"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "rooms" && event.roomBookings.length
              ? ` (${event.roomBookings.length})`
              : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {DAY_SCOPED.includes(tab) ? (
          <DaySelector
            eventId={event.id}
            days={event.days}
            selectedDayId={selectedDayId}
            onSelect={setSelectedDayId}
            onChanged={reload}
          />
        ) : null}

        {tab === "schedule" ? (
          <ScheduleTab
            event={event}
            selectedDayId={selectedDayId}
            spaces={spaces}
            reload={reload}
          />
        ) : tab === "products" ? (
          <ProductsTab event={event} selectedDayId={selectedDayId} reload={reload} />
        ) : tab === "rooms" ? (
          <RoomsTab event={event} reload={reload} />
        ) : tab === "tasks" ? (
          <TasksTab event={event} reload={reload} />
        ) : tab === "notes" ? (
          <NotesTab event={event} reload={reload} />
        ) : (
          <ActivityTab event={event} />
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-base bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu event={event} />
          <Button
            size="sm"
            variant="subtle"
            onClick={async () => {
              const copy = await api.post<EventFull>(`/api/events/${eventId}/duplicate`);
              onChanged();
              alert(`Duplicated as “${copy.title}”.`);
            }}
          >
            Duplicate
          </Button>
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-rose-600 hover:bg-rose-500/10"
              onClick={async () => {
                if (confirm("Delete this event permanently?")) {
                  await api.del(`/api/events/${eventId}`);
                  onChanged();
                  onClose();
                }
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
