import { prisma } from "./db";
import { resolveSetup } from "./setup-rules";

export interface SlotSetupFields {
  setupId: string | null;
  setupTableCount: number | null;
  setupHeadTables: boolean;
  setupManual: boolean;
}

// Compute the setup columns to persist on a slot. When `manual` is false the
// layout is auto-derived from the setup's rules + person count; when true the
// caller's table/head values are kept (so later person-count changes don't
// override a manual adjustment). The setup must belong to the slot's space.
export async function computeSlotSetup(params: {
  spaceId: string;
  personCount: number;
  setupId: string | null;
  manual: boolean;
  tableCount: number | null;
  headTables: boolean;
}): Promise<SlotSetupFields> {
  if (!params.setupId) {
    return { setupId: null, setupTableCount: null, setupHeadTables: false, setupManual: false };
  }
  const setup = await prisma.setup.findFirst({
    where: { id: params.setupId, spaceId: params.spaceId },
    include: { rules: true },
  });
  if (!setup) {
    return { setupId: null, setupTableCount: null, setupHeadTables: false, setupManual: false };
  }
  if (params.manual) {
    return {
      setupId: setup.id,
      setupTableCount: params.tableCount,
      setupHeadTables: params.headTables,
      setupManual: true,
    };
  }
  const r = resolveSetup(setup.rules, params.personCount);
  return {
    setupId: setup.id,
    setupTableCount: r.tableCount,
    setupHeadTables: r.headTables,
    setupManual: false,
  };
}
