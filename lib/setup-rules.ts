// Resolve a setup's layout attributes for a given person count by applying the
// highest matching threshold rule (person_count >= minPersons). Shared by the
// API (auto-apply on save) and the UI (live preview).

export interface SetupRuleLike {
  minPersons: number;
  tableCount: number | null;
  headTables: boolean;
}

export interface ResolvedSetup {
  tableCount: number | null;
  headTables: boolean;
}

export function resolveSetup(
  rules: SetupRuleLike[],
  personCount: number,
): ResolvedSetup {
  let tableCount: number | null = null;
  let headTables = false;
  // Apply every rule whose threshold is met; later (higher) thresholds win for
  // tableCount, and headTables is sticky once any matched rule sets it.
  for (const r of [...rules].sort((a, b) => a.minPersons - b.minPersons)) {
    if (personCount >= r.minPersons) {
      if (r.tableCount != null) tableCount = r.tableCount;
      if (r.headTables) headTables = true;
    }
  }
  return { tableCount, headTables };
}
