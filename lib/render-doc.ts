import { prisma } from "./db";
import type { FullEvent } from "./event-include";
import { buildFunctionSheet } from "./function-sheet";
import {
  DEFAULT_FUNCTION_SHEET_TEMPLATE,
  DEFAULT_PROPOSAL_TEMPLATE,
  buildDocVars,
  renderTemplate,
} from "./doc-template";
import { renderDocPdf } from "./pdf";
import { renderDocDocx } from "./docx-gen";

export type DocKind = "function_sheet" | "proposal";
export type DocFormat = "pdf" | "docx";

const TEMPLATE_KEY: Record<DocKind, string> = {
  function_sheet: "template_function_sheet",
  proposal: "template_proposal",
};
const DEFAULT_TEMPLATE: Record<DocKind, string> = {
  function_sheet: DEFAULT_FUNCTION_SHEET_TEMPLATE,
  proposal: DEFAULT_PROPOSAL_TEMPLATE,
};

export async function getTemplate(kind: DocKind, organizationId: string): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId, key: TEMPLATE_KEY[kind] } },
  });
  return row?.value?.trim() ? row.value : DEFAULT_TEMPLATE[kind];
}

export async function getCancellationPolicy(organizationId: string): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId, key: "cancellation_policy" } },
  });
  return row?.value ?? "";
}

export interface RenderedDoc {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

// Render an event document (function sheet or proposal) for a given format,
// optionally scoped to a single day.
export async function renderEventDoc(
  event: FullEvent,
  opts: { kind: DocKind; format: DocFormat; dayId?: string | null },
): Promise<RenderedDoc> {
  const data = buildFunctionSheet(event, opts.dayId);
  const policy = await getCancellationPolicy(event.organizationId);
  const vars = buildDocVars(data, { cancellationPolicy: policy });
  const template = await getTemplate(opts.kind, event.organizationId);
  const blocks = renderTemplate(template, vars);

  const base = `${opts.kind === "proposal" ? "proposal" : "function-sheet"}-${safeName(
    event.title,
  ) || "event"}`;

  if (opts.format === "docx") {
    const buffer = await renderDocDocx(blocks, data);
    return {
      buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: `${base}.docx`,
    };
  }
  const buffer = await renderDocPdf(blocks, data);
  return { buffer, contentType: "application/pdf", filename: `${base}.pdf` };
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
