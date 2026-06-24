"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import { formatMoney } from "@/lib/money";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, EVENT_STATUS_STYLES, type EventStatus } from "@/lib/enums";
import { useMe } from "@/components/MeProvider";
import { Button, Card, EmptyState, Spinner } from "@/components/ui";

interface ReportData {
  month: string;
  eventsInMonth: number;
  total: number;
  byStatus: Record<string, number>;
  byDay: { date: string; gross: number }[];
  byWeek: { weekStart: string; gross: number }[];
  trend: { month: string; events: number; revenue: number }[];
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const { permissions } = useMe();
  const allowed = Boolean(permissions.VIEW_GLOBAL_ACTIVITY);
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await api.get<ReportData>(`/api/reports?month=${month}`));
    setLoading(false);
  }, [month]);

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
  }, [allowed, load]);

  const maxTrendRev = useMemo(
    () => Math.max(1, ...(data?.trend.map((t) => t.revenue) ?? [1])),
    [data],
  );
  const maxDay = useMemo(
    () => Math.max(1, ...(data?.byDay.map((d) => d.gross) ?? [1])),
    [data],
  );

  if (!allowed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState icon="🔒" title="Managers & admins only" description="You don't have access to reporting." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Reporting</h1>
          <p className="text-sm text-ink-muted">Events and revenue on the books.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
            ‹
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth(thisMonth())}>
            This month
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
            ›
          </Button>
          <span className="ml-2 text-sm font-semibold text-ink">{monthLabel(month)}</span>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-16 text-ink-muted">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick counts */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Events this month" value={String(data.eventsInMonth)} />
            <Stat label="Revenue on the books" value={formatMoney(data.total)} accent />
            <Stat
              label="Confirmed revenue"
              value={formatMoney(data.byStatus.CONFIRMED ?? 0)}
            />
          </div>

          {/* Revenue by status */}
          <Card className="p-4">
            <H>Revenue by status</H>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EVENT_STATUSES.map((s) => (
                <div key={s} className="flex items-center justify-between rounded-lg border border-base px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
                    <span className={`h-2.5 w-2.5 rounded-full ${EVENT_STATUS_STYLES[s as EventStatus].dot}`} />
                    {EVENT_STATUS_LABELS[s as EventStatus]}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {formatMoney(data.byStatus[s] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* 6-month trend */}
          <Card className="p-4">
            <H>Last 6 months</H>
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {data.trend.map((t) => (
                <div key={t.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-ink-muted">{formatMoney(t.revenue)}</span>
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${Math.max(2, (t.revenue / maxTrendRev) * 120)}px` }}
                    title={`${t.events} events · ${formatMoney(t.revenue)}`}
                  />
                  <span className="text-[10px] font-medium text-ink-soft">
                    {t.month.slice(5)}/{t.month.slice(2, 4)}
                  </span>
                  <span className="text-[10px] text-ink-muted">{t.events} ev</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Revenue by day + week */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <H>Revenue by day</H>
              {data.byDay.length === 0 ? (
                <p className="text-sm text-ink-muted">No revenue dated this month.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.byDay.map((d) => (
                    <div key={d.date} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 text-ink-muted">
                        {new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      <div className="h-3 flex-1 rounded bg-muted">
                        <div
                          className="h-3 rounded bg-brand-500"
                          style={{ width: `${(d.gross / maxDay) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right font-medium text-ink">
                        {formatMoney(d.gross)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <H>Revenue by week</H>
              {data.byWeek.length === 0 ? (
                <p className="text-sm text-ink-muted">No revenue dated this month.</p>
              ) : (
                <div className="divide-y divide-base">
                  {data.byWeek.map((w) => (
                    <div key={w.weekStart} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-ink-muted">
                        Week of{" "}
                        {new Date(w.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      <span className="font-medium text-ink">{formatMoney(w.gross)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? "text-brand-600 dark:text-brand-300" : "text-ink"}`}>
        {value}
      </div>
    </Card>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-sm font-semibold text-ink">{children}</div>;
}
