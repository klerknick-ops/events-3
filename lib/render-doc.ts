import { imageSize } from "image-size";
import { prisma } from "./db";
import type { FullEvent } from "./event-include";
import { buildFunctionSheet } from "./function-sheet";
import {
  DEFAULT_FUNCTION_SHEET_TEMPLATE,
  DEFAULT_PROPOSAL_TEMPLATE,
  DEFAULT_CONFIRMATION_TEMPLATE,
  DEFAULT_PROFORMA_TEMPLATE,
  buildDocVars,
  renderTemplate,
  type DocBlock,
  type DocImage,
  type ImageMap,
} from "./doc-template";
import { renderDocPdf } from "./pdf";
import { renderDocDocx } from "./docx-gen";
import { getObject, keyFromUrl } from "./storage";

export type DocKind = "function_sheet" | "proposal" | "confirmation" | "proforma";
export type DocFormat = "pdf" | "docx";

const TEMPLATE_KEY: Record<DocKind, string> = {
  function_sheet: "template_function_sheet",
  proposal: "template_proposal",
  confirmation: "template_confirmation",
  proforma: "template_proforma",
};
export const DEFAULT_TEMPLATE: Record<DocKind, string> = {
  function_sheet: DEFAULT_FUNCTION_SHEET_TEMPLATE,
  proposal: DEFAULT_PROPOSAL_TEMPLATE,
  confirmation: DEFAULT_CONFIRMATION_TEMPLATE,
  proforma: DEFAULT_PROFORMA_TEMPLATE,
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

// Fetch the bytes + dimensions for an image referenced in a template.
async function resolveImage(src: string): Promise<DocImage | null> {
  try {
    let bytes: Buffer | null = null;
    const key = keyFromUrl(src);
    if (key) {
      const obj = await getObject(key);
      bytes = obj?.body ?? null;
    } else if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
    }
    if (!bytes) return null;
    const dim = imageSize(bytes);
    if (!dim.width || !dim.height) return null;
    return { buffer: bytes, width: dim.width, height: dim.height, type: dim.type || "png" };
  } catch {
    return null;
  }
}

async function loadImages(blocks: DocBlock[]): Promise<ImageMap> {
  const map: ImageMap = new Map();
  const srcs = [...new Set(blocks.flatMap((b) => (b.type === "image" ? [b.src] : [])))];
  await Promise.all(
    srcs.map(async (s) => {
      const img = await resolveImage(s);
      if (img) map.set(s, img);
    }),
  );
  return map;
}

// Render an event document for a given kind/format, optionally scoped to a day.
export async function renderEventDoc(
  event: FullEvent,
  opts: { kind: DocKind; format: DocFormat; dayId?: string | null },
): Promise<RenderedDoc> {
  const data = buildFunctionSheet(event, opts.dayId);
  const policy = await getCancellationPolicy(event.organizationId);
  const vars = buildDocVars(data, {
    cancellationPolicy: policy,
    paymentTerms: event.paymentTerms?.body ?? "",
    paymentTermsName: event.paymentTerms?.name ?? "",
    depositPercent: event.paymentTerms?.depositPercent ?? null,
  });
  const template = await getTemplate(opts.kind, event.organizationId);
  const blocks = renderTemplate(template, vars);
  const images = await loadImages(blocks);

  const prefix =
    opts.kind === "proposal"
      ? "proposal"
      : opts.kind === "confirmation"
        ? "confirmation"
        : opts.kind === "proforma"
          ? "proforma"
          : "function-sheet";
  const base = `${prefix}-${safeName(event.title) || "event"}`;

  if (opts.format === "docx") {
    const buffer = await renderDocDocx(blocks, data, images);
    return {
      buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: `${base}.docx`,
    };
  }
  const buffer = await renderDocPdf(blocks, data, images);
  return { buffer, contentType: "application/pdf", filename: `${base}.pdf` };
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
