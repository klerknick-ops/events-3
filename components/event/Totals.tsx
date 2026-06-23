"use client";

import { formatMoney, type Totals } from "@/lib/money";

export function TotalsSummary({ totals }: { totals: Totals }) {
  return (
    <div className="rounded-lg border border-base bg-surface-2 p-3 text-sm">
      <div className="flex justify-between text-ink-soft">
        <span>Net</span>
        <span>{formatMoney(totals.net)}</span>
      </div>
      {totals.byRate.map((r) => (
        <div
          key={r.taxRate}
          className="flex justify-between text-xs text-ink-muted"
        >
          <span>Tax @ {r.taxRate}%</span>
          <span>{formatMoney(r.taxAmount)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-base pt-2 text-base font-semibold text-ink">
        <span>Total</span>
        <span>{formatMoney(totals.gross)}</span>
      </div>
    </div>
  );
}
