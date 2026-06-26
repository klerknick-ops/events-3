// Default OTB ("on the books") revenue weights per event status. Admins can
// override these per-status (StatusWeight). Cancelled events count for nothing.
export const DEFAULT_STATUS_WEIGHTS: Record<string, number> = {
  INQUIRY: 50,
  TENTATIVE: 70,
  CONFIRMED: 100,
  COMPLETED: 100,
  CANCELLED: 0,
};

// Resolve the org's weight map (percent) merged over the defaults.
export function resolveWeights(rows: { status: string; weightPercent: number }[]): Record<string, number> {
  const out: Record<string, number> = { ...DEFAULT_STATUS_WEIGHTS };
  for (const r of rows) out[r.status] = r.weightPercent;
  return out;
}
