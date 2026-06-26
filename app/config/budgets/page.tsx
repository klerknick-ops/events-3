"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { EVENT_STATUS_LABELS, type EventStatus } from "@/lib/enums";
import { Button, Card, Input, Spinner } from "@/components/ui";

interface Budget {
  month: string;
  amount: number;
}
interface StatusWeight {
  status: string;
  weightPercent: number;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// 12 months from the start of the current year.
function yearMonths(): string[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<StatusWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const months = yearMonths();

  async function load() {
    setLoading(true);
    const [b, w] = await Promise.all([
      api.get<Budget[]>("/api/budgets"),
      api.get<StatusWeight[]>("/api/status-weights"),
    ]);
    setBudgets(Object.fromEntries(b.map((x) => [x.month, x.amount])));
    setWeights(w);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function saveBudget(month: string, amount: number) {
    setBudgets((cur) => ({ ...cur, [month]: amount }));
    await api.put("/api/budgets", { month, amount });
  }
  async function saveWeight(status: string, weightPercent: number) {
    setWeights((cur) => cur.map((w) => (w.status === status ? { ...w, weightPercent } : w)));
    await api.put("/api/status-weights", { status, weightPercent });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-ink-muted">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">Monthly budget targets</h2>
        <p className="mb-3 text-sm text-ink-muted">Target revenue per calendar month, shown against weighted OTB revenue in Reporting.</p>
        <Card className="divide-y divide-base">
          {months.map((m) => (
            <div key={m} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-ink">{monthLabel(m)}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-ink-muted">€</span>
                <Input
                  type="number"
                  min={0}
                  step="100"
                  className="w-36"
                  defaultValue={budgets[m] ?? ""}
                  placeholder="0"
                  onBlur={(e) => saveBudget(m, Number(e.target.value) || 0)}
                />
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">Status revenue weighting (OTB)</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Percentage of an event&rsquo;s value counted toward On-The-Books revenue, by status.
        </p>
        <Card className="divide-y divide-base">
          {weights.map((w) => (
            <div key={w.status} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-ink">{EVENT_STATUS_LABELS[w.status as EventStatus] ?? w.status}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-24"
                  defaultValue={w.weightPercent}
                  onBlur={(e) => saveWeight(w.status, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                />
                <span className="text-sm text-ink-muted">%</span>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
