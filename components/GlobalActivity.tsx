"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/fetcher";
import type { ActivityEntry } from "@/lib/types";
import { activityIcon } from "@/lib/activity-display";
import { Card, EmptyState, Field, Select, Input, Spinner } from "@/components/ui";

export function GlobalActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api.get<ActivityEntry[]>("/api/activity").then((e) => {
      setEntries(e);
      setLoading(false);
    });
  }, []);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) if (e.user) map.set(e.user.id, e.user.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (userId && e.userId !== userId) return false;
      const t = new Date(e.createdAt).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [entries, userId, from, to]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Activity log</h1>
        <p className="text-sm text-ink-muted">
          Every meaningful change across all events — who did what, and when.
        </p>
      </div>

      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="User">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All users</option>
              {users.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🗂" title="No activity" description="No entries match these filters." />
      ) : (
        <Card className="divide-y divide-base">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 text-sm">{activityIcon(e.action)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink">{e.summary}</div>
                <div className="text-xs text-ink-muted">
                  <span className="font-medium">{e.user?.name ?? "System"}</span>
                  {e.event ? (
                    <>
                      {" · "}
                      <Link
                        href={`/timeline?event=${e.event.id}`}
                        className="hover:text-brand-700 hover:underline"
                      >
                        {e.event.title}
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
