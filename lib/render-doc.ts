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
import {
  annotateDiff,
  buildSnapshot,
  snapshotsEqual,
  type DocSnapshot,
} from "./doc-version";

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
// Full-event exports (no dayId) are recorded as versions in the event's document
// history; when `highlight` is set and a previous version exists, changed line
// items are tagged so the renderers mark them with a yellow background.
export async function renderEventDoc(
  event: FullEvent,
  opts: {
    kind: DocKind;
    format: DocFormat;
    dayId?: string | null;
    highlight?: boolean;
  },
): Promise<RenderedDoc> {
  const data = buildFunctionSheet(event, opts.dayId);

  // Version history + diff (full-event scope only — per-day exports skip this).
  if (!opts.dayId) {
    await applyVersioning(event, opts.kind, data, opts.highlight ?? false);
  }

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

// Record a new version (only when content changed vs the latest stored version)
// and, if requested, annotate the live data with diff tags vs the previous
// distinct version so the renderers can highlight what changed.
async function applyVersioning(
  event: FullEvent,
  kind: DocKind,
  data: ReturnType<typeof buildFunctionSheet>,
  highlight: boolean,
): Promise<void> {
  const newSnap = buildSnapshot(data);
  const recent = await prisma.generatedDocument.findMany({
    where: { eventId: event.id, docType: kind },
    orderBy: { version: "desc" },
    take: 2,
  });
  const latest = recent[0];
  const latestSnap = latest ? (latest.snapshot as unknown as DocSnapshot) : null;
  const sameAsLatest = latestSnap ? snapshotsEqual(latestSnap, newSnap) : false;

  // The version to diff against = the most recent version whose content differs
  // from what we're producing now.
  const priorSnap = sameAsLatest
    ? recent[1]
      ? (recent[1].snapshot as unknown as DocSnapshot)
      : null
    : latestSnap;

  if (highlight && priorSnap) annotateDiff(data, priorSnap);

  // Save a new version only when content actually changed.
  if (!latest || !sameAsLatest) {
    await prisma.generatedDocument.create({
      data: {
        organizationId: event.organizationId,
        eventId: event.id,
        docType: kind,
        version: (latest?.version ?? 0) + 1,
        snapshot: newSnap as unknown as object,
      },
    });
  }
}

export interface DocVersionInfo {
  id: string;
  version: number;
  generatedAt: string;
}

// Version history for one doc type on an event (newest first).
export async function listDocVersions(
  eventId: string,
  kind: DocKind,
): Promise<DocVersionInfo[]> {
  const rows = await prisma.generatedDocument.findMany({
    where: { eventId, docType: kind },
    orderBy: { version: "desc" },
    select: { id: true, version: true, generatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    generatedAt: r.generatedAt.toISOString(),
  }));
}
