// Central money + tax math. All monetary values are stored as Float and
// rounded to 2 decimals at calculation boundaries to avoid drift.

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "EUR";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineTax {
  net: number; // net total for the line (unit net * qty)
  taxRate: number; // percentage
  taxAmount: number;
  gross: number;
}

export function lineTotals(
  unitNet: number,
  quantity: number,
  taxRate: number,
): LineTax {
  const net = round2(unitNet * quantity);
  const taxAmount = round2(net * (taxRate / 100));
  const gross = round2(net + taxAmount);
  return { net, taxRate, taxAmount, gross };
}

export interface TaxBreakdownRow {
  taxRate: number;
  net: number;
  taxAmount: number;
  gross: number;
}

export interface Totals {
  net: number;
  taxAmount: number;
  gross: number;
  byRate: TaxBreakdownRow[];
}

// Aggregate a set of lines into an overall total plus a per-rate breakdown.
export function sumTotals(lines: LineTax[]): Totals {
  const byRateMap = new Map<number, TaxBreakdownRow>();
  let net = 0;
  let taxAmount = 0;
  let gross = 0;

  for (const l of lines) {
    net = round2(net + l.net);
    taxAmount = round2(taxAmount + l.taxAmount);
    gross = round2(gross + l.gross);

    const existing = byRateMap.get(l.taxRate);
    if (existing) {
      existing.net = round2(existing.net + l.net);
      existing.taxAmount = round2(existing.taxAmount + l.taxAmount);
      existing.gross = round2(existing.gross + l.gross);
    } else {
      byRateMap.set(l.taxRate, {
        taxRate: l.taxRate,
        net: l.net,
        taxAmount: l.taxAmount,
        gross: l.gross,
      });
    }
  }

  const byRate = [...byRateMap.values()].sort((a, b) => a.taxRate - b.taxRate);
  return { net, taxAmount, gross, byRate };
}

export function formatMoney(amount: number, currency = CURRENCY): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
