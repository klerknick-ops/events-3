"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { ActivityEntry, EventFull } from "@/lib/types";
import { activityIcon } from "@/lib/activity-display";
import { Spinner } from "@/components/ui";
import { Empty, SectionHeader } from "../PanelBits";

export function ActivityTab({ event }: { event: EventFull }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ActivityEntry[]>(`/api/events/${event.id}/activity`)
      .then((e) => {
        setEntries(e);
        setLoading(false);
      });
  }, [event.id]);

  return (
    <section>
      <SectionHeader title="Activity" />
      {loading ? (
        <div className="flex justify-center py-6 text-ink-muted">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <Empty>No activity recorded yet.</Empty>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mt-0.5 text-sm">{activityIcon(e.action)}</span>
              <div className="min-w-0 flex-1 border-b border-base pb-3">
                <div className="text-sm text-ink">{e.summary}</div>
                <div className="text-xs text-ink-muted">
                  {e.user?.name ?? "System"} ·{" "}
                  {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
